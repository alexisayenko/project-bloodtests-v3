import { CSRF_HEADER, isAllowed, readSession, refreshedSessionCookie, type Session } from './auth'

export interface DataEnv {
  GITHUB_REPO?: string
  ALLOWED_EMAILS?: string
  GITHUB_TOKEN?: string
  SESSION_SECRET?: string
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

export interface DataDeps {
  fetch: FetchFn
  now?: () => number
}

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const DEFAULT_REPO = 'alexisayenko/data-storage'
const BRANCH = 'main'
const ROOT_SEGMENTS = ['paneloom', 'users']
const TOP_LEVEL_FILES = ['medications.json', 'scheduled-visits.json', 'settings.json', 'manifest.json']
const KEY_PATTERN = /^(reports\/[A-Za-z0-9._-]+\.json|medications\.json|scheduled-visits\.json|settings\.json|manifest\.json)$/
const EMAIL_PATTERN = /^[a-z0-9][a-z0-9._+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/

const encoder = new TextEncoder()

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export function userFolder(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(normalized) || normalized.includes('..')) {
    throw new HttpError(403, 'Forbidden')
  }
  return [...ROOT_SEGMENTS, normalized].join('/')
}

export async function authenticate(request: Request, env: DataEnv, nowMs: number, known?: Session | null): Promise<string> {
  const session = known === undefined ? await readSession(request, env, nowMs) : known
  if (!session) throw new HttpError(401, 'Not signed in')
  if (!isAllowed(session.email, env.ALLOWED_EMAILS)) throw new HttpError(403, 'Forbidden')
  return session.email.trim().toLowerCase()
}

function assertSameOriginWrite(request: Request): void {
  if (request.headers.get(CSRF_HEADER) !== '1') throw new HttpError(403, 'Forbidden')
  const origin = request.headers.get('origin')
  if (origin !== null && origin !== new URL(request.url).origin) throw new HttpError(403, 'Forbidden')
}

export async function gitBlobSha(text: string): Promise<string> {
  const body = encoder.encode(text)
  const header = encoder.encode(`blob ${body.length}\0`)
  const data = new Uint8Array(header.length + body.length)
  data.set(header)
  data.set(body, header.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', data))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

interface TreeEntry {
  path: string
  mode: string
  type: string
  sha?: string | null
  content?: string
}

interface GitTree {
  tree: TreeEntry[]
  truncated?: boolean
}

class GitHub {
  private readonly repo: string
  private readonly base: string
  private readonly token: string
  private readonly doFetch: FetchFn

  constructor(env: DataEnv, doFetch: FetchFn) {
    if (!env.GITHUB_TOKEN) throw new HttpError(500, 'Server not configured')
    this.token = env.GITHUB_TOKEN
    this.repo = env.GITHUB_REPO || DEFAULT_REPO
    this.base = `https://api.github.com/repos/${this.repo}`
    this.doFetch = doFetch
  }

  async request(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<Response> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.token}`,
      accept,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'paneloom-worker',
    }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    return this.doFetch(`${this.base}${path}`, { ...init, headers })
  }

  async ok(path: string, init?: RequestInit, accept?: string): Promise<Response> {
    const response = await this.request(path, init, accept)
    if (!response.ok) throw new HttpError(502, `GitHub request failed (${response.status})`)
    return response
  }

  async headCommit(): Promise<{ commit: string; tree: string } | null> {
    const ref = await this.request(`/git/ref/heads/${BRANCH}`)
    if (ref.status === 404) return null
    if (!ref.ok) throw new HttpError(502, `GitHub request failed (${ref.status})`)
    const commit = ((await ref.json()) as { object: { sha: string } }).object.sha
    const detail = (await (await this.ok(`/git/commits/${commit}`)).json()) as { tree: { sha: string } }
    return { commit, tree: detail.tree.sha }
  }

  async folderTree(rootTree: string, segments: string[]): Promise<TreeEntry[]> {
    let sha = rootTree
    for (const segment of segments) {
      const listing = (await (await this.ok(`/git/trees/${sha}`)).json()) as GitTree
      const next = listing.tree.find((entry) => entry.type === 'tree' && entry.path === segment)
      if (!next?.sha) return []
      sha = next.sha
    }
    const full = (await (await this.ok(`/git/trees/${sha}?recursive=1`)).json()) as GitTree
    if (full.truncated) throw new HttpError(502, 'Folder listing truncated')
    return full.tree.filter((entry) => entry.type === 'blob' && entry.path !== '.keep' && !entry.path.endsWith('/.keep'))
  }

  async graphql<T>(query: string, variables: Record<string, string>): Promise<T> {
    const response = await this.doFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'user-agent': 'paneloom-worker',
      },
      body: JSON.stringify({ query, variables }),
    })
    if (!response.ok) throw new HttpError(502, `GitHub request failed (${response.status})`)
    const result = (await response.json()) as { data?: T; errors?: unknown[] }
    if (result.errors?.length || !result.data) throw new HttpError(502, 'GitHub query failed')
    return result.data
  }

  ownerAndName(): [string, string] {
    const [owner, name] = this.repo.split('/')
    return [owner, name]
  }
}

const READ_QUERY = `query($owner:String!,$name:String!,$reports:String!${TOP_LEVEL_FILES.map((_, i) => `,$f${i}:String!`).join('')}){
  repository(owner:$owner,name:$name){
    reports:object(expression:$reports){...on Tree{entries{name type object{...on Blob{text isTruncated}}}}}
${TOP_LEVEL_FILES.map((_, i) => `    f${i}:object(expression:$f${i}){...on Blob{text isTruncated}}`).join('\n')}
  }
}`

interface GqlBlob {
  text?: string | null
  isTruncated?: boolean
}

interface ReadResult {
  repository: Record<string, unknown> & {
    reports?: { entries?: { name: string; type: string; object?: GqlBlob | null }[] } | null
  } | null
}

function blobText(blob: GqlBlob | null | undefined, key: string): string {
  if (blob?.isTruncated || typeof blob?.text !== 'string') throw new HttpError(502, `Cannot read ${key}`)
  return blob.text
}

export async function readFiles(env: DataEnv, doFetch: FetchFn, email: string): Promise<Record<string, string>> {
  const gh = new GitHub(env, doFetch)
  const folder = `${BRANCH}:${userFolder(email)}`
  const [owner, name] = gh.ownerAndName()
  const variables: Record<string, string> = { owner, name, reports: `${folder}/reports` }
  TOP_LEVEL_FILES.forEach((file, i) => {
    variables[`f${i}`] = `${folder}/${file}`
  })
  const { repository } = await gh.graphql<ReadResult>(READ_QUERY, variables)
  if (!repository) throw new HttpError(502, 'Repository not found')
  const files: Record<string, string> = {}
  for (const entry of repository.reports?.entries ?? []) {
    const key = `reports/${entry.name}`
    if (entry.type !== 'blob' || !KEY_PATTERN.test(key)) continue
    files[key] = blobText(entry.object, key)
  }
  TOP_LEVEL_FILES.forEach((file, i) => {
    const blob = repository[`f${i}`] as GqlBlob | null | undefined
    if (blob) files[file] = blobText(blob, file)
  })
  return files
}

export async function writeFiles(
  env: DataEnv,
  doFetch: FetchFn,
  email: string,
  files: Record<string, string>,
): Promise<{ commit: string | null }> {
  const gh = new GitHub(env, doFetch)
  const head = await gh.headCommit()
  if (!head) throw new HttpError(502, 'Repository branch not found')
  const folder = userFolder(email)
  const existing = await gh.folderTree(head.tree, folder.split('/'))
  const existingSha = new Map(existing.map((entry) => [entry.path, entry.sha as string]))

  const entries: TreeEntry[] = []
  for (const [key, text] of Object.entries(files)) {
    if (existingSha.get(key) === (await gitBlobSha(text))) continue
    entries.push({ path: `${folder}/${key}`, mode: '100644', type: 'blob', content: text })
  }
  for (const key of existingSha.keys()) {
    if (KEY_PATTERN.test(key) && !Object.hasOwn(files, key)) entries.push({ path: `${folder}/${key}`, mode: '100644', type: 'blob', sha: null })
  }
  if (entries.length === 0) return { commit: null }

  const tree = (await (
    await gh.ok('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree, tree: entries }) })
  ).json()) as { sha: string }
  const commit = (await (
    await gh.ok('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: `sync: ${Object.keys(files).length} files`,
        tree: tree.sha,
        parents: [head.commit],
      }),
    })
  ).json()) as { sha: string }
  const update = await gh.request(`/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  })
  if (update.status === 422 || update.status === 409) throw new HttpError(409, 'Data changed remotely; retry')
  if (!update.ok) throw new HttpError(502, `GitHub request failed (${update.status})`)
  return { commit: commit.sha }
}

export function parseFilesBody(body: unknown): Record<string, string> {
  const files = (body as { files?: unknown } | null)?.files
  if (typeof files !== 'object' || files === null || Array.isArray(files)) {
    throw new HttpError(400, 'Body must be {files: Record<string,string>}')
  }
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(files)) {
    if (!KEY_PATTERN.test(key)) throw new HttpError(400, `Invalid file path: ${key}`)
    if (typeof value !== 'string') throw new HttpError(400, `File content must be a string: ${key}`)
    result[key] = value
  }
  if (!Object.keys(result).some((key) => key !== 'settings.json' && key !== 'manifest.json')) {
    throw new HttpError(400, 'Body must include at least one report, medications or scheduled-visits file')
  }
  return result
}

export async function handleDataRequest(request: Request, env: DataEnv, deps: DataDeps): Promise<Response> {
  try {
    if (request.method !== 'GET' && request.method !== 'PUT') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json; charset=utf-8', allow: 'GET, PUT' },
      })
    }
    const nowMs = (deps.now ?? Date.now)()
    const session = await readSession(request, env, nowMs)
    const email = await authenticate(request, env, nowMs, session)
    const withSession = async (response: Response): Promise<Response> => {
      const refreshed = await refreshedSessionCookie(request, env, nowMs, session)
      if (refreshed) response.headers.append('set-cookie', refreshed)
      return response
    }
    if (request.method === 'GET') {
      return withSession(json(200, { files: await readFiles(env, deps.fetch, email) }))
    }
    assertSameOriginWrite(request)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Body must be JSON')
    }
    return withSession(json(200, await writeFiles(env, deps.fetch, email, parseFilesBody(body))))
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message })
    return json(502, { error: 'Upstream request failed' })
  }
}
