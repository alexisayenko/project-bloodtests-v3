import { describe, it, expect } from 'vitest';
import {
  gitBlobSha,
  handleDataRequest,
  userFolder,
  verifySupabaseJwt,
  type DataEnv,
  type FetchFn,
} from '../worker/githubData';

const SECRET = 'test-secret';
const NOW = 1_700_000_000_000;
const encoder = new TextEncoder();

function b64url(bytes: Uint8Array | string): string {
  const data = typeof bytes === 'string' ? encoder.encode(bytes) : bytes;
  let binary = '';
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: object, secret = SECRET, alg = 'HS256'): Promise<string> {
  const head = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

const validPayload = { email: 'Alex.Isayenko@gmail.com', exp: NOW / 1000 + 600 };

const env: DataEnv = {
  GITHUB_REPO: 'o/r',
  ALLOWED_EMAILS: 'alex.isayenko@gmail.com, other@example.com',
  GITHUB_TOKEN: 'gh-secret-token',
  SUPABASE_JWT_SECRET: SECRET,
};

const FOLDER = 'paneloom/users/alex.isayenko@gmail.com';

interface Call {
  method: string;
  url: string;
  body?: Record<string, unknown>;
  accept?: string;
  auth?: string;
}

type Handler = (call: Call) => Response | undefined;

function stubFetch(handlers: Handler[]) {
  const calls: Call[] = [];
  const fn = async (input: string, init: RequestInit = {}) => {
    const headers = init.headers as Record<string, string>;
    const call: Call = {
      method: init.method ?? 'GET',
      url: input.replace('https://api.github.com/repos/o/r', ''),
      body: init.body ? JSON.parse(init.body as string) : undefined,
      accept: headers.accept,
      auth: headers.authorization,
    };
    calls.push(call);
    for (const h of handlers) {
      const r = h(call);
      if (r) return r;
    }
    return new Response('not stubbed', { status: 500 });
  };
  return { fn, calls };
}

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function repoHandlers(existing: Record<string, string>): Promise<Handler[]> {
  const shas = new Map<string, string>();
  const blobs = new Map<string, string>();
  for (const [path, text] of Object.entries(existing)) {
    const sha = await gitBlobSha(text);
    shas.set(path, sha);
    blobs.set(sha, text);
  }
  return [
    (c) => (c.url === '/git/ref/heads/main' ? jsonRes({ object: { sha: 'commit0' } }) : undefined),
    (c) => (c.url === '/git/commits/commit0' ? jsonRes({ tree: { sha: 'root' } }) : undefined),
    (c) => (c.url === '/git/trees/root' ? jsonRes({ tree: [{ path: 'paneloom', type: 'tree', sha: 'pl' }] }) : undefined),
    (c) => (c.url === '/git/trees/pl' ? jsonRes({ tree: [{ path: 'users', type: 'tree', sha: 'us' }] }) : undefined),
    (c) => (c.url === '/git/trees/us' ? jsonRes({ tree: [{ path: 'alex.isayenko@gmail.com', type: 'tree', sha: 'me' }] }) : undefined),
    (c) =>
      c.url === '/git/trees/me?recursive=1'
        ? jsonRes({
            tree: [
              { path: 'reports', type: 'tree', sha: 'x' },
              { path: '.keep', type: 'blob', sha: 'keep' },
              ...[...shas].map(([path, sha]) => ({ path, type: 'blob', mode: '100644', sha })),
            ],
            truncated: false,
          })
        : undefined,
    (c) => {
      const m = /^\/git\/blobs\/(.+)$/.exec(c.url);
      return m && blobs.has(m[1]) ? new Response(blobs.get(m[1])) : undefined;
    },
  ];
}

const req = (method: string, token?: string, body?: unknown) =>
  new Request('https://paneloom.com/api/data', {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('verifySupabaseJwt', () => {
  it('accepts a valid token and returns the email', async () => {
    expect(await verifySupabaseJwt(await sign(validPayload), SECRET, NOW)).toBe('Alex.Isayenko@gmail.com');
  });
  it('rejects an expired token', async () => {
    await expect(verifySupabaseJwt(await sign({ ...validPayload, exp: NOW / 1000 - 1 }), SECRET, NOW)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects a token without exp', async () => {
    await expect(verifySupabaseJwt(await sign({ email: 'a@b.co' }), SECRET, NOW)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects a bad signature', async () => {
    await expect(verifySupabaseJwt(await sign(validPayload, 'other'), SECRET, NOW)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects a non-HS256 alg', async () => {
    await expect(verifySupabaseJwt(await sign(validPayload, SECRET, 'none'), SECRET, NOW)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects a token that is not yet valid and accepts one whose nbf has passed', async () => {
    await expect(verifySupabaseJwt(await sign({ ...validPayload, nbf: NOW / 1000 + 60 }), SECRET, NOW)).rejects.toMatchObject({ status: 401 });
    await expect(verifySupabaseJwt(await sign({ ...validPayload, nbf: 'soon' }), SECRET, NOW)).rejects.toMatchObject({ status: 401 });
    expect(await verifySupabaseJwt(await sign({ ...validPayload, nbf: NOW / 1000 - 60 }), SECRET, NOW)).toBe('Alex.Isayenko@gmail.com');
  });
  it('rejects a token without an email claim', async () => {
    await expect(verifySupabaseJwt(await sign({ exp: validPayload.exp }), SECRET, NOW)).rejects.toMatchObject({ status: 401 });
    await expect(verifySupabaseJwt(await sign({ exp: validPayload.exp, email: 5 }), SECRET, NOW)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects malformed tokens', async () => {
    await expect(verifySupabaseJwt('abc', SECRET, NOW)).rejects.toMatchObject({ status: 401 });
    await expect(verifySupabaseJwt('a.b.c', SECRET, NOW)).rejects.toMatchObject({ status: 401 });
  });
});

describe('userFolder', () => {
  it('lowercases a plain email', () => {
    expect(userFolder('Alex.Isayenko@Gmail.com')).toBe(FOLDER);
  });
  it.each(['../evil@x.com', 'a/b@x.com', 'a@x.com/../..', '..@x.com', 'a b@x.com', 'a@x', '', 'a\\b@x.com'])(
    'rejects %j',
    (bad) => {
      expect(() => userFolder(bad)).toThrow();
    },
  );
});

describe('handleDataRequest auth', () => {
  const deps = (fn: FetchFn) => ({ fetch: fn, now: () => NOW });

  it('401 without a token, never touching GitHub', async () => {
    const { fn, calls } = stubFetch([]);
    const res = await handleDataRequest(req('GET'), env, deps(fn));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toHaveProperty('error');
    expect(calls).toHaveLength(0);
  });
  it('401 for a bad signature', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await sign(validPayload, 'nope')), env, deps(fn));
    expect(res.status).toBe(401);
  });
  it('403 when the email is not allowed', async () => {
    const { fn, calls } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await sign({ ...validPayload, email: 'x@evil.com' })), env, deps(fn));
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it('403 for everyone when ALLOWED_EMAILS is unset', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await sign(validPayload)), { ...env, ALLOWED_EMAILS: undefined }, deps(fn));
    expect(res.status).toBe(403);
  });
  it('405 for other methods', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('POST', await sign(validPayload)), env, deps(fn));
    expect(res.status).toBe(405);
  });
});

describe('GET', () => {
  const deps = (fn: FetchFn) => ({ fetch: fn, now: () => NOW });

  const gql = (repository: unknown, extra: object = {}): Handler => (c) =>
    c.url === 'https://api.github.com/graphql' ? jsonRes({ data: { repository }, ...extra }) : undefined;

  it('maps one GraphQL response to a files record in a single request', async () => {
    const { fn, calls } = stubFetch([
      gql({
        reports: {
          entries: [
            { name: '2022-06-23__ygia.json', type: 'blob', object: { text: '{"a":1}', isTruncated: false } },
            { name: '.keep', type: 'blob', object: { text: '', isTruncated: false } },
            { name: 'sub', type: 'tree', object: {} },
            { name: 'notes.txt', type: 'blob', object: { text: 'x', isTruncated: false } },
          ],
        },
        f0: { text: '[]', isTruncated: false },
        f1: null,
        f2: { text: '{"s":1}', isTruncated: false },
        f3: { text: '{"m":1}', isTruncated: false },
      }),
    ]);
    const res = await handleDataRequest(req('GET', await sign(validPayload)), env, deps(fn));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      files: {
        'reports/2022-06-23__ygia.json': '{"a":1}',
        'medications.json': '[]',
        'settings.json': '{"s":1}',
        'manifest.json': '{"m":1}',
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].auth).toBe('Bearer gh-secret-token');
    const vars = calls[0].body!.variables as Record<string, string>;
    expect(vars).toMatchObject({
      owner: 'o',
      name: 'r',
      reports: `main:${FOLDER}/reports`,
      f0: `main:${FOLDER}/medications.json`,
      f1: `main:${FOLDER}/scheduled-visits.json`,
      f2: `main:${FOLDER}/settings.json`,
      f3: `main:${FOLDER}/manifest.json`,
    });
  });

  it('returns empty files when the folder is missing', async () => {
    const { fn } = stubFetch([gql({ reports: null, f0: null, f1: null, f2: null, f3: null })]);
    const res = await handleDataRequest(req('GET', await sign(validPayload)), env, deps(fn));
    expect(await res.json()).toEqual({ files: {} });
  });

  it('502 when a blob is truncated', async () => {
    const { fn } = stubFetch([gql({ f0: { text: 'partial', isTruncated: true } })]);
    const res = await handleDataRequest(req('GET', await sign(validPayload)), env, deps(fn));
    expect(res.status).toBe(502);
  });

  it('502 on GraphQL errors or a missing repository', async () => {
    for (const handler of [gql(null), gql({}, { errors: [{ message: 'boom' }] })]) {
      const { fn } = stubFetch([handler]);
      const res = await handleDataRequest(req('GET', await sign(validPayload)), env, deps(fn));
      expect(res.status).toBe(502);
    }
  });

  it('does not leak the GitHub token on upstream failure', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await sign(validPayload)), env, deps(fn));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('gh-secret-token');
  });
});

describe('PUT', () => {
  const deps = (fn: FetchFn) => ({ fetch: fn, now: () => NOW });

  const writeHandlers = (refStatus = 200): Handler[] => [
    (c) => (c.url === '/git/trees' && c.method === 'POST' ? jsonRes({ sha: 'newtree' }, 201) : undefined),
    (c) => (c.url === '/git/commits' && c.method === 'POST' ? jsonRes({ sha: 'newcommit' }, 201) : undefined),
    (c) =>
      c.url === '/git/refs/heads/main' && c.method === 'PATCH'
        ? jsonRes(refStatus === 200 ? {} : { message: 'x' }, refStatus)
        : undefined,
  ];

  it('builds one commit with changed files and deletions', async () => {
    const { fn, calls } = stubFetch([
      ...writeHandlers(),
      ...(await repoHandlers({
        'reports/old.json': 'old',
        'reports/same.json': 'same',
        'medications.json': 'meds-v1',
      })),
    ]);
    const res = await handleDataRequest(
      req('PUT', await sign(validPayload), {
        files: {
          'reports/same.json': 'same',
          'medications.json': 'meds-v2',
          'scheduled-visits.json': '[]',
          'settings.json': '{}',
          'manifest.json': '{}',
        },
      }),
      env,
      deps(fn),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ commit: 'newcommit' });

    const tree = calls.find((c) => c.url === '/git/trees' && c.method === 'POST')!.body;
    expect(tree.base_tree).toBe('root');
    expect(tree.tree).toEqual([
      { path: `${FOLDER}/medications.json`, mode: '100644', type: 'blob', content: 'meds-v2' },
      { path: `${FOLDER}/scheduled-visits.json`, mode: '100644', type: 'blob', content: '[]' },
      { path: `${FOLDER}/settings.json`, mode: '100644', type: 'blob', content: '{}' },
      { path: `${FOLDER}/manifest.json`, mode: '100644', type: 'blob', content: '{}' },
      { path: `${FOLDER}/reports/old.json`, mode: '100644', type: 'blob', sha: null },
    ]);
    const commit = calls.find((c) => c.url === '/git/commits')!.body;
    expect(commit).toEqual({ message: 'sync: 5 files', tree: 'newtree', parents: ['commit0'] });
    const ref = calls.find((c) => c.method === 'PATCH')!.body;
    expect(ref).toEqual({ sha: 'newcommit', force: false });
  });

  it('creates no commit when the folder already matches', async () => {
    const { fn, calls } = stubFetch([
      ...writeHandlers(),
      ...(await repoHandlers({ 'reports/a.json': 'A', 'medications.json': 'M' })),
    ]);
    const res = await handleDataRequest(
      req('PUT', await sign(validPayload), { files: { 'reports/a.json': 'A', 'medications.json': 'M' } }),
      env,
      deps(fn),
    );
    expect(await res.json()).toEqual({ commit: null });
    expect(calls.some((c) => c.method !== 'GET')).toBe(false);
  });

  it('deletes only existing blobs whose path GET could return', async () => {
    const { fn, calls } = stubFetch([
      ...writeHandlers(),
      ...(await repoHandlers({
        'README.md': 'r',
        'reports/sub/x.json': 'x',
        'reports/old.json': 'old',
        'settings.json': 's',
        'medications.json': 'm',
      })),
    ]);
    const res = await handleDataRequest(
      req('PUT', await sign(validPayload), { files: { 'medications.json': 'm' } }),
      env,
      deps(fn),
    );
    expect(res.status).toBe(200);
    const tree = calls.find((c) => c.url === '/git/trees' && c.method === 'POST')!.body!.tree;
    expect(tree).toEqual([
      { path: `${FOLDER}/reports/old.json`, mode: '100644', type: 'blob', sha: null },
      { path: `${FOLDER}/settings.json`, mode: '100644', type: 'blob', sha: null },
    ]);
  });

  it('does not treat inherited property names as present files', async () => {
    const { fn, calls } = stubFetch([
      ...writeHandlers(),
      ...(await repoHandlers({ 'reports/constructor.json': 'c', 'medications.json': 'm' })),
    ]);
    const res = await handleDataRequest(
      req('PUT', await sign(validPayload), { files: { 'medications.json': 'm' } }),
      env,
      deps(fn),
    );
    expect(res.status).toBe(200);
    const tree = calls.find((c) => c.url === '/git/trees' && c.method === 'POST')!.body!.tree;
    expect(tree).toEqual([{ path: `${FOLDER}/reports/constructor.json`, mode: '100644', type: 'blob', sha: null }]);
  });

  it('maps ref-update conflicts to 409', async () => {
    for (const status of [422, 409]) {
      const { fn } = stubFetch([...writeHandlers(status), ...(await repoHandlers({}))]);
      const res = await handleDataRequest(
        req('PUT', await sign(validPayload), { files: { 'medications.json': '[]' } }),
        env,
        deps(fn),
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toHaveProperty('error');
    }
  });

  it.each([
    [{ files: { '../x.json': 'a' } }],
    [{ files: { 'reports/../x.json': 'a' } }],
    [{ files: { 'reports/a/b.json': 'a' } }],
    [{ files: { 'other.json': 'a' } }],
    [{ files: { 'sub/settings.json': 'a' } }],
    [{ files: { 'medications.json': 5 } }],
    [{ files: [] }],
    [{ files: {} }],
    [{ files: { 'settings.json': '{}', 'manifest.json': '{}' } }],
    [{}],
  ])('400 for invalid body %j', async (body) => {
    const { fn, calls } = stubFetch([]);
    const res = await handleDataRequest(req('PUT', await sign(validPayload), body), env, deps(fn));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
