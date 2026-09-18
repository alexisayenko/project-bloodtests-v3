import type { FetchFn } from './githubData'

export interface AuthEnv {
  ALLOWED_EMAILS?: string
  SESSION_SECRET?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  APPLE_TEAM_ID?: string
  APPLE_KEY_ID?: string
  APPLE_SERVICE_ID?: string
  APPLE_PRIVATE_KEY?: string
}

export interface AuthDeps {
  fetch: FetchFn
  now?: () => number
  random?: (length: number) => Uint8Array
}

export type Provider = 'google' | 'apple'

export interface Session {
  email: string
  provider: Provider
  iat: number
  exp: number
}

export const SESSION_COOKIE = 'paneloom_session'
export const OAUTH_COOKIE = 'paneloom_oauth'
export const CSRF_HEADER = 'x-paneloom'
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
export const OAUTH_TTL_SECONDS = 10 * 60
export const MIN_SESSION_SECRET_LENGTH = 32

const ACCOUNT_ROUTE = '/#account'
const APPLE_AUDIENCE = 'https://appleid.apple.com'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('bad base64url')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function textToBase64Url(text: string): string {
  return bytesToBase64Url(encoder.encode(text))
}

function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  let diff = x.length ^ y.length
  const length = Math.max(x.length, y.length)
  for (let i = 0; i < length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

async function hmacKey(secret: string, usages: ('sign' | 'verify')[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages)
}

async function signPayload(secret: string, payload: object): Promise<string> {
  const body = textToBase64Url(JSON.stringify(payload))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), encoder.encode(body))
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`
}

async function verifyPayload(secret: string, value: string): Promise<unknown> {
  const parts = value.split('.')
  if (parts.length !== 2) return null
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret, ['verify']),
      base64UrlToBytes(parts[1]),
      encoder.encode(parts[0]),
    )
    if (!valid) return null
    return JSON.parse(decoder.decode(base64UrlToBytes(parts[0])))
  } catch {
    return null
  }
}

export function hasValidSecret(env: AuthEnv): env is AuthEnv & { SESSION_SECRET: string } {
  return typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= MIN_SESSION_SECRET_LENGTH
}

export function isAllowed(email: string, allowed: string | undefined): boolean {
  if (!allowed) return false
  const target = email.trim().toLowerCase()
  return allowed
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry !== '' && entry === target)
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return null
}

export async function signSession(
  env: AuthEnv,
  identity: { email: string; provider: Provider },
  nowMs: number,
): Promise<string> {
  if (!hasValidSecret(env)) throw new Error('SESSION_SECRET missing or too short')
  const iat = Math.floor(nowMs / 1000)
  const session: Session = { ...identity, iat, exp: iat + SESSION_TTL_SECONDS }
  return signPayload(env.SESSION_SECRET, session)
}

export async function readSession(request: Request, env: AuthEnv, nowMs: number): Promise<Session | null> {
  if (!hasValidSecret(env)) return null
  const value = readCookie(request, SESSION_COOKIE)
  if (!value) return null
  const payload = (await verifyPayload(env.SESSION_SECRET, value)) as Partial<Session> | null
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.email !== 'string' || payload.email === '') return null
  if (payload.provider !== 'google' && payload.provider !== 'apple') return null
  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null
  if (payload.exp * 1000 <= nowMs) return null
  return payload as Session
}

function sessionCookie(value: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

// Apple's form_post callback is a cross-site POST, which only a SameSite=None cookie survives.
function oauthCookie(value: string, maxAge: number, provider: Provider): string {
  const sameSite = provider === 'apple' ? 'None' : 'Lax'
  return `${OAUTH_COOKIE}=${value}; HttpOnly; Secure; SameSite=${sameSite}; Path=/auth; Max-Age=${maxAge}`
}

function jsonResponse(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  })
}

function errorPage(status: number, message: string, cookies: string[] = []): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign-in failed</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>Sign-in failed</h1><p>${message}</p><p><a href="${ACCOUNT_ROUTE}">Back to Paneloom</a></p></body></html>`
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(html, { status, headers })
}

interface ProviderConfig {
  clientId: string
  authorizeUrl: string
  tokenUrl: string
  issuers: string[]
  clientSecret: (nowMs: number) => Promise<string>
}

function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, '\n')
}

export async function buildAppleClientSecret(env: AuthEnv, nowMs: number): Promise<string> {
  const pem = normalizePem(env.APPLE_PRIVATE_KEY ?? '')
  const der = base64UrlToBytes(
    pem
      .replace(/-----BEGIN [A-Z ]+-----|-----END [A-Z ]+-----|\s+/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  )
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const iat = Math.floor(nowMs / 1000)
  const header = textToBase64Url(JSON.stringify({ alg: 'ES256', kid: env.APPLE_KEY_ID, typ: 'JWT' }))
  const claims = textToBase64Url(
    JSON.stringify({ iss: env.APPLE_TEAM_ID, iat, exp: iat + 300, aud: APPLE_AUDIENCE, sub: env.APPLE_SERVICE_ID }),
  )
  const signingInput = `${header}.${claims}`
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(signingInput))
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`
}

function providerConfig(provider: string, env: AuthEnv): ProviderConfig | null {
  if (!hasValidSecret(env)) return null
  if (provider === 'google') {
    const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: secret } = env
    if (!clientId || !secret) return null
    return {
      clientId,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      issuers: ['https://accounts.google.com', 'accounts.google.com'],
      clientSecret: async () => secret,
    }
  }
  if (provider === 'apple') {
    const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICE_ID, APPLE_PRIVATE_KEY } = env
    if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_SERVICE_ID || !APPLE_PRIVATE_KEY) return null
    return {
      clientId: APPLE_SERVICE_ID,
      authorizeUrl: 'https://appleid.apple.com/auth/authorize',
      tokenUrl: 'https://appleid.apple.com/auth/token',
      issuers: [APPLE_AUDIENCE],
      clientSecret: (nowMs) => buildAppleClientSecret(env, nowMs),
    }
  }
  return null
}

interface OAuthState {
  provider: Provider
  state: string
  nonce: string
  verifier: string
  exp: number
}

function randomToken(deps: AuthDeps, length = 32): string {
  const bytes = deps.random ? deps.random(length) : crypto.getRandomValues(new Uint8Array(length))
  return bytesToBase64Url(bytes)
}

async function login(request: Request, env: AuthEnv, deps: AuthDeps, provider: string): Promise<Response> {
  const config = providerConfig(provider, env)
  if (!config || !hasValidSecret(env)) return jsonResponse(404, { error: 'Provider not available' })
  const nowMs = (deps.now ?? Date.now)()
  const flow: OAuthState = {
    provider: provider as Provider,
    state: randomToken(deps),
    nonce: randomToken(deps),
    verifier: randomToken(deps),
    exp: Math.floor(nowMs / 1000) + OAUTH_TTL_SECONDS,
  }
  const origin = new URL(request.url).origin
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${origin}/auth/callback/${provider}`,
    response_type: 'code',
    state: flow.state,
    nonce: flow.nonce,
  })
  if (provider === 'google') {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(flow.verifier))
    params.set('scope', 'openid email')
    params.set('code_challenge', bytesToBase64Url(new Uint8Array(digest)))
    params.set('code_challenge_method', 'S256')
  } else {
    params.set('scope', 'email')
    params.set('response_mode', 'form_post')
  }
  const headers = new Headers({
    location: `${config.authorizeUrl}?${params.toString()}`,
    'cache-control': 'no-store',
  })
  headers.append('set-cookie', oauthCookie(await signPayload(env.SESSION_SECRET, flow), OAUTH_TTL_SECONDS, flow.provider))
  return new Response(null, { status: 302, headers })
}

interface IdClaims {
  iss?: unknown
  aud?: unknown
  exp?: unknown
  nonce?: unknown
  email?: unknown
  email_verified?: unknown
}

function decodeIdToken(idToken: string): IdClaims {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('malformed id_token')
  return JSON.parse(decoder.decode(base64UrlToBytes(parts[1]))) as IdClaims
}

function validateClaims(claims: IdClaims, config: ProviderConfig, nonce: string, nowMs: number): string {
  if (typeof claims.iss !== 'string' || !config.issuers.includes(claims.iss)) throw new Error('iss')
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audiences.includes(config.clientId)) throw new Error('aud')
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) throw new Error('exp')
  if (typeof claims.nonce !== 'string' || !safeEqual(claims.nonce, nonce)) throw new Error('nonce')
  if (typeof claims.email !== 'string' || claims.email === '') throw new Error('email')
  if (claims.email_verified !== true && claims.email_verified !== 'true') throw new Error('unverified')
  return claims.email.trim().toLowerCase()
}

async function callback(request: Request, env: AuthEnv, deps: AuthDeps, provider: string): Promise<Response> {
  const expectedMethod = provider === 'apple' ? 'POST' : 'GET'
  const config = providerConfig(provider, env)
  if (!config || !hasValidSecret(env)) return jsonResponse(404, { error: 'Provider not available' })
  if (request.method !== expectedMethod) {
    return jsonResponse(405, { error: 'Method not allowed' }, { allow: expectedMethod })
  }
  const clear = [oauthCookie('', 0, provider as Provider)]
  const fail = (status: number, message: string) => errorPage(status, message, clear)

  const nowMs = (deps.now ?? Date.now)()
  const raw = readCookie(request, OAUTH_COOKIE)
  const flow = raw ? ((await verifyPayload(env.SESSION_SECRET, raw)) as Partial<OAuthState> | null) : null
  if (
    !flow ||
    flow.provider !== provider ||
    typeof flow.state !== 'string' ||
    typeof flow.nonce !== 'string' ||
    typeof flow.verifier !== 'string' ||
    typeof flow.exp !== 'number' ||
    flow.exp * 1000 <= nowMs
  ) {
    return fail(400, 'The sign-in attempt expired or did not start here. Please try again.')
  }

  const params =
    request.method === 'POST' ? new URLSearchParams(await request.text()) : new URL(request.url).searchParams
  if (params.get('error')) return fail(400, 'Sign-in was cancelled or refused by the provider.')
  const state = params.get('state')
  const code = params.get('code')
  if (!state || !safeEqual(state, flow.state)) return fail(400, 'The sign-in response did not match the request.')
  if (!code) return fail(400, 'The provider returned no authorization code.')

  let email: string
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${new URL(request.url).origin}/auth/callback/${provider}`,
      client_id: config.clientId,
      client_secret: await config.clientSecret(nowMs),
    })
    if (provider === 'google') body.set('code_verifier', flow.verifier)
    const response = await deps.fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: body.toString(),
    })
    if (!response.ok) return fail(502, 'The provider rejected the sign-in.')
    const idToken = ((await response.json()) as { id_token?: unknown }).id_token
    if (typeof idToken !== 'string') return fail(502, 'The provider returned no identity.')
    email = validateClaims(decodeIdToken(idToken), config, flow.nonce, nowMs)
  } catch {
    return fail(502, 'The provider response could not be verified.')
  }

  if (!isAllowed(email, env.ALLOWED_EMAILS)) return fail(403, 'This account is not allowed to sign in.')

  const headers = new Headers({ location: ACCOUNT_ROUTE, 'cache-control': 'no-store' })
  headers.append('set-cookie', oauthCookie('', 0, provider as Provider))
  headers.append(
    'set-cookie',
    sessionCookie(await signSession(env, { email, provider: provider as Provider }, nowMs), SESSION_TTL_SECONDS),
  )
  return new Response(null, { status: 303, headers })
}

export async function handleAuthRequest(request: Request, env: AuthEnv, deps: AuthDeps): Promise<Response> {
  const path = new URL(request.url).pathname
  const nowMs = (deps.now ?? Date.now)()

  if (path === '/auth/me') {
    if (request.method !== 'GET') return jsonResponse(405, { error: 'Method not allowed' }, { allow: 'GET' })
    const session = await readSession(request, env, nowMs)
    if (!session) return jsonResponse(401, {})
    if (!isAllowed(session.email, env.ALLOWED_EMAILS)) return jsonResponse(403, {})
    return jsonResponse(200, { email: session.email, provider: session.provider })
  }

  if (path === '/auth/logout') {
    if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' }, { allow: 'POST' })
    if (request.headers.get(CSRF_HEADER) !== '1') return jsonResponse(403, { error: 'Forbidden' })
    const headers = new Headers({ 'cache-control': 'no-store' })
    headers.append('set-cookie', sessionCookie('', 0))
    return new Response(null, { status: 204, headers })
  }

  const route = /^\/auth\/(login|callback)\/([^/]+)$/.exec(path)
  if (route) {
    try {
      if (route[1] === 'login') {
        if (request.method !== 'GET') return jsonResponse(405, { error: 'Method not allowed' }, { allow: 'GET' })
        return await login(request, env, deps, route[2])
      }
      return await callback(request, env, deps, route[2])
    } catch {
      return errorPage(502, 'Something went wrong. Please try again.')
    }
  }

  return jsonResponse(404, { error: 'Not found' })
}
