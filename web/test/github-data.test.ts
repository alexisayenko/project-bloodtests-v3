import { describe, it, expect } from 'vitest';
import { SESSION_COOKIE, signSession } from '../worker/auth';
import {
  gitBlobSha,
  handleDataRequest,
  userFolder,
  type DataEnv,
  type FetchFn,
} from '../worker/githubData';

const SECRET = 'test-secret-'.repeat(4);
const NOW = 1_700_000_000_000;

const env: DataEnv = {
  GITHUB_REPO: 'o/r',
  ALLOWED_EMAILS: 'alex.isayenko@gmail.com, other@example.com',
  GITHUB_TOKEN: 'gh-secret-token',
  SESSION_SECRET: SECRET,
};

async function session(email = 'Alex.Isayenko@gmail.com', now = NOW, secret = SECRET): Promise<string> {
  return signSession({ SESSION_SECRET: secret }, { email, provider: 'google' }, now);
}

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

const req = (method: string, cookie?: string, body?: unknown, headers: Record<string, string> = {}) => {
  const all: Record<string, string> = { ...headers };
  if (cookie) all.cookie = `${SESSION_COOKIE}=${cookie}`;
  if (method === 'PUT' && !('x-paneloom' in all)) all['x-paneloom'] = '1';
  return new Request('https://paneloom.com/api/data', {
    method,
    headers: all,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

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

  it('401 without a session cookie, never touching GitHub', async () => {
    const { fn, calls } = stubFetch([]);
    const res = await handleDataRequest(req('GET'), env, deps(fn));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toHaveProperty('error');
    expect(calls).toHaveLength(0);
  });
  it('401 for a session signed with another secret', async () => {
    const { fn, calls } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await session('alex.isayenko@gmail.com', NOW, 'n'.repeat(32))), env, deps(fn));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it('401 for a tampered session payload', async () => {
    const { fn } = stubFetch([]);
    const [, sig] = (await session()).split('.');
    const forged = btoa(JSON.stringify({ email: 'other@example.com', provider: 'google', iat: 1, exp: 9_999_999_999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const res = await handleDataRequest(req('GET', `${forged}.${sig}`), env, deps(fn));
    expect(res.status).toBe(401);
  });
  it('401 for an expired session', async () => {
    const { fn } = stubFetch([]);
    const old = await session('alex.isayenko@gmail.com', NOW - 31 * 24 * 3600 * 1000);
    const res = await handleDataRequest(req('GET', old), env, deps(fn));
    expect(res.status).toBe(401);
  });
  it('401 for everyone when SESSION_SECRET is unset', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await session()), { ...env, SESSION_SECRET: undefined }, deps(fn));
    expect(res.status).toBe(401);
  });
  it('403 when the email is not allowed', async () => {
    const { fn, calls } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await session('x@evil.com')), env, deps(fn));
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it('403 immediately once an email is removed from the allowlist', async () => {
    const { fn } = stubFetch([]);
    const cookie = await session('other@example.com');
    const res = await handleDataRequest(req('GET', cookie), { ...env, ALLOWED_EMAILS: 'alex.isayenko@gmail.com' }, deps(fn));
    expect(res.status).toBe(403);
  });
  it('403 for everyone when ALLOWED_EMAILS is unset', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await session()), { ...env, ALLOWED_EMAILS: undefined }, deps(fn));
    expect(res.status).toBe(403);
  });
  it('405 for other methods', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('POST', await session()), env, deps(fn));
    expect(res.status).toBe(405);
  });
  it('a GET needs neither the CSRF header nor an Origin', async () => {
    const { fn } = stubFetch([
      (c) => (c.url === 'https://api.github.com/graphql' ? jsonRes({ data: { repository: { reports: null } } }) : undefined),
    ]);
    const res = await handleDataRequest(req('GET', await session()), env, deps(fn));
    expect(res.status).toBe(200);
  });
});

describe('PUT CSRF guards', () => {
  const deps = (fn: FetchFn) => ({ fetch: fn, now: () => NOW });
  const body = { files: { 'medications.json': '[]' } };

  it('403 without the X-Paneloom header', async () => {
    const { fn, calls } = stubFetch([]);
    const request = new Request('https://paneloom.com/api/data', {
      method: 'PUT',
      headers: { cookie: `${SESSION_COOKIE}=${await session()}` },
      body: JSON.stringify(body),
    });
    const res = await handleDataRequest(request, env, deps(fn));
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it('403 for a foreign Origin, even with the header', async () => {
    const { fn, calls } = stubFetch([]);
    const res = await handleDataRequest(
      req('PUT', await session(), body, { origin: 'https://evil.example' }),
      env,
      deps(fn),
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it('accepts a matching Origin', async () => {
    const { fn, calls } = stubFetch([]);
    const res = await handleDataRequest(
      req('PUT', await session(), body, { origin: 'https://paneloom.com' }),
      env,
      deps(fn),
    );
    expect(res.status).toBe(502);
    expect(calls.length).toBeGreaterThan(0);
  });
  it('401 (not 403) for an unauthenticated PUT', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('PUT', undefined, body), env, deps(fn));
    expect(res.status).toBe(401);
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
    const res = await handleDataRequest(req('GET', await session()), env, deps(fn));
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
    const res = await handleDataRequest(req('GET', await session()), env, deps(fn));
    expect(await res.json()).toEqual({ files: {} });
  });

  it('502 when a blob is truncated', async () => {
    const { fn } = stubFetch([gql({ f0: { text: 'partial', isTruncated: true } })]);
    const res = await handleDataRequest(req('GET', await session()), env, deps(fn));
    expect(res.status).toBe(502);
  });

  it('502 on GraphQL errors or a missing repository', async () => {
    for (const handler of [gql(null), gql({}, { errors: [{ message: 'boom' }] })]) {
      const { fn } = stubFetch([handler]);
      const res = await handleDataRequest(req('GET', await session()), env, deps(fn));
      expect(res.status).toBe(502);
    }
  });

  it('does not leak the GitHub token on upstream failure', async () => {
    const { fn } = stubFetch([]);
    const res = await handleDataRequest(req('GET', await session()), env, deps(fn));
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
      req('PUT', await session(), {
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
      req('PUT', await session(), { files: { 'reports/a.json': 'A', 'medications.json': 'M' } }),
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
      req('PUT', await session(), { files: { 'medications.json': 'm' } }),
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
      req('PUT', await session(), { files: { 'medications.json': 'm' } }),
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
        req('PUT', await session(), { files: { 'medications.json': '[]' } }),
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
    const res = await handleDataRequest(req('PUT', await session(), body), env, deps(fn));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
