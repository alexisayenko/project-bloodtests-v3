import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  base64UrlToBytes,
  buildAppleClientSecret,
  bytesToBase64Url,
  handleAuthRequest,
  readSession,
  refreshedSessionCookie,
  resetJwksCache,
  signSession,
  type AuthDeps,
  type AuthEnv,
} from '../worker/auth';

const NOW = 1_700_000_000_000;
const ORIGIN = 'https://paneloom.com';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const LONG_SECRET = 's'.repeat(40);
let publicKey: CryptoKey;
let rsaPrivate: CryptoKey;
let otherRsaPrivate: CryptoKey;
let jwk: JsonWebKey;
const KID = 'test-kid';
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS = 'https://appleid.apple.com/auth/keys';
let baseEnv: AuthEnv;

function toPem(der: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  publicKey = pair.publicKey;
  const rsaParams = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  const rsa = await crypto.subtle.generateKey(rsaParams, true, ['sign', 'verify']);
  rsaPrivate = rsa.privateKey;
  jwk = { ...(await crypto.subtle.exportKey('jwk', rsa.publicKey)), kid: KID, alg: 'RS256', use: 'sig' };
  otherRsaPrivate = (await crypto.subtle.generateKey(rsaParams, true, ['sign', 'verify'])).privateKey;
  baseEnv = {
    SESSION_SECRET: LONG_SECRET,
    ALLOWED_EMAILS: 'alex.isayenko@gmail.com',
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    APPLE_TEAM_ID: 'TEAM123',
    APPLE_KEY_ID: 'KEY456',
    APPLE_SERVICE_ID: 'com.paneloom.web',
    APPLE_PRIVATE_KEY: toPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).replace(/\n/g, '\\n'),
  };
});

function b64json(value: object): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

async function idToken(claims: object, opts: { key?: CryptoKey; kid?: string } = {}): Promise<string> {
  const input = `${b64json({ alg: 'RS256', kid: opts.kid ?? KID })}.${b64json(claims)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', opts.key ?? rsaPrivate, encoder.encode(input));
  return `${input}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

interface TokenCall {
  url: string;
  body: URLSearchParams;
}

interface TokenOpts {
  status?: number;
  key?: CryptoKey;
  kid?: string;
  jwks?: () => object[];
}

function tokenFetch(claims: object | null, opts: TokenOpts = {}) {
  const status = opts.status ?? 200;
  const calls: TokenCall[] = [];
  const jwksCalls: string[] = [];
  const fn = async (input: string, init: RequestInit = {}) => {
    if (input === GOOGLE_JWKS || input === APPLE_JWKS) {
      jwksCalls.push(input);
      return new Response(JSON.stringify({ keys: (opts.jwks ?? (() => [jwk]))() }));
    }
    calls.push({ url: input, body: new URLSearchParams(init.body as string) });
    if (status !== 200) return new Response('provider-secret-detail', { status });
    return new Response(JSON.stringify(claims ? { id_token: await idToken(claims, opts) } : {}), { status });
  };
  return { fn, calls, jwksCalls };
}

beforeEach(() => resetJwksCache());

const deps = (fn: AuthDeps['fetch']): AuthDeps => ({ fetch: fn, now: () => NOW });
const never = deps(async () => {
  throw new Error('unexpected fetch');
});

function cookieValue(res: Response, name: string): string | undefined {
  const line = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return line?.slice(name.length + 1).split(';')[0];
}

function cookieLine(res: Response, name: string): string {
  return res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`)) ?? '';
}

async function startLogin(provider: string, env = baseEnv, origin = ORIGIN) {
  const res = await handleAuthRequest(new Request(`${origin}/auth/login/${provider}`), env, never);
  const location = new URL(res.headers.get('location') ?? 'https://none.invalid/');
  return { res, location, oauth: cookieValue(res, OAUTH_COOKIE) ?? '' };
}

function oauthPayload(cookie: string): { state: string; nonce: string; verifier: string } {
  return JSON.parse(decoder.decode(base64UrlToBytes(cookie.split('.')[0])));
}

function goodClaims(overrides: object = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: 'google-client',
    exp: NOW / 1000 + 300,
    email: 'Alex.Isayenko@gmail.com',
    email_verified: true,
    ...overrides,
  };
}

async function googleCallback(
  claims: object | null,
  opts: { env?: AuthEnv; state?: string; cookie?: string; query?: string; status?: number; token?: TokenOpts } = {},
) {
  const { location, oauth } = await startLogin('google', opts.env);
  const { fn, calls, jwksCalls } = tokenFetch(claims === null ? null : { nonce: location.searchParams.get('nonce'), ...claims }, {
    ...opts.token,
    status: opts.status,
  });
  const state = opts.state ?? location.searchParams.get('state');
  const url = `${ORIGIN}/auth/callback/google?${opts.query ?? `code=abc&state=${state}`}`;
  const request = new Request(url, { headers: { cookie: `${OAUTH_COOKIE}=${opts.cookie ?? oauth}` } });
  const res = await handleAuthRequest(request, opts.env ?? baseEnv, deps(fn));
  return { res, calls, jwksCalls, oauth, location };
}

describe('login', () => {
  it('redirects to Google with code flow, PKCE S256, state and nonce', async () => {
    const { res, location, oauth } = await startLogin('google');
    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const p = location.searchParams;
    expect(p.get('client_id')).toBe('google-client');
    expect(p.get('redirect_uri')).toBe(`${ORIGIN}/auth/callback/google`);
    expect(p.get('response_type')).toBe('code');
    expect(p.get('scope')).toBe('openid email');
    expect(p.get('code_challenge_method')).toBe('S256');
    const flow = oauthPayload(oauth);
    expect(p.get('state')).toBe(flow.state);
    expect(p.get('nonce')).toBe(flow.nonce);
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(flow.verifier));
    expect(p.get('code_challenge')).toBe(bytesToBase64Url(new Uint8Array(digest)));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('redirects to Apple with form_post, email scope and nonce', async () => {
    const { res, location, oauth } = await startLogin('apple');
    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe('https://appleid.apple.com/auth/authorize');
    const p = location.searchParams;
    expect(p.get('client_id')).toBe('com.paneloom.web');
    expect(p.get('redirect_uri')).toBe(`${ORIGIN}/auth/callback/apple`);
    expect(p.get('response_mode')).toBe('form_post');
    expect(p.get('scope')).toBe('email');
    expect(p.get('response_type')).toBe('code');
    expect(p.get('nonce')).toBe(oauthPayload(oauth).nonce);
    expect(p.get('state')).toBe(oauthPayload(oauth).state);
  });

  it('sets the Apple flow cookie HttpOnly, Secure, SameSite=None for ten minutes', async () => {
    const { res } = await startLogin('apple');
    const line = cookieLine(res, OAUTH_COOKIE);
    expect(line).toContain('HttpOnly');
    expect(line).toContain('Secure');
    expect(line).toContain('SameSite=None');
    expect(line).toContain('Max-Age=600');
  });

  it('sets the Google flow cookie SameSite=Lax', async () => {
    const { res } = await startLogin('google');
    expect(cookieLine(res, OAUTH_COOKIE)).toContain('SameSite=Lax');
  });

  it('builds the redirect URI from the request origin', async () => {
    const { location } = await startLogin('google', baseEnv, 'https://paneloom.example.workers.dev');
    expect(location.searchParams.get('redirect_uri')).toBe('https://paneloom.example.workers.dev/auth/callback/google');
  });

  it('uses the injected random source', async () => {
    const random = (n: number) => new Uint8Array(n).fill(7);
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/login/google`), baseEnv, { ...never, random });
    expect(new URL(res.headers.get('location')!).searchParams.get('state')).toBe(bytesToBase64Url(new Uint8Array(32).fill(7)));
  });

  it.each([
    ['an unknown provider', 'github', {}],
    ['Google without credentials', 'google', { GOOGLE_CLIENT_SECRET: undefined }],
    ['Apple without a key', 'apple', { APPLE_PRIVATE_KEY: undefined }],
    ['a missing SESSION_SECRET', 'google', { SESSION_SECRET: undefined }],
    ['a SESSION_SECRET under 32 characters', 'google', { SESSION_SECRET: 'x'.repeat(31) }],
  ])('404 JSON for %s', async (_label, provider, override) => {
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/login/${provider}`), { ...baseEnv, ...override }, never);
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty('error');
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});

describe('Google callback', () => {
  it('signs in an allowed, verified email and exchanges the code with PKCE', async () => {
    const { res, calls, location, oauth } = await googleCallback(goodClaims());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/#account');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://oauth2.googleapis.com/token');
    expect(Object.fromEntries(calls[0].body)).toEqual({
      grant_type: 'authorization_code',
      code: 'abc',
      redirect_uri: `${ORIGIN}/auth/callback/google`,
      client_id: 'google-client',
      client_secret: 'google-secret',
      code_verifier: oauthPayload(oauth).verifier,
    });
    expect(location.searchParams.get('state')).toBeTruthy();

    const session = cookieLine(res, SESSION_COOKIE);
    expect(session).toContain('HttpOnly');
    expect(session).toContain('Secure');
    expect(session).toContain('SameSite=Lax');
    expect(session).toContain('Path=/');
    expect(session).toContain('Max-Age=2592000');
    expect(cookieLine(res, OAUTH_COOKIE)).toContain('Max-Age=0');

    const me = await handleAuthRequest(
      new Request(`${ORIGIN}/auth/me`, { headers: { cookie: `${SESSION_COOKIE}=${cookieValue(res, SESSION_COOKIE)}` } }),
      baseEnv,
      deps(async () => new Response()),
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ email: 'alex.isayenko@gmail.com', provider: 'google' });
  });

  it('accepts the bare accounts.google.com issuer and an aud array', async () => {
    const { res } = await googleCallback(goodClaims({ iss: 'accounts.google.com', aud: ['x', 'google-client'] }));
    expect(res.status).toBe(303);
  });

  it.each([
    ['a nonce mismatch', { nonce: 'other' }],
    ['a wrong audience', { aud: 'someone-else' }],
    ['a wrong issuer', { iss: 'https://evil.example' }],
    ['an expired id_token', { exp: NOW / 1000 - 1 }],
    ['an unverified email', { email_verified: false }],
    ['a missing email_verified', { email_verified: undefined }],
    ['a missing email', { email: undefined }],
  ])('rejects %s without setting a session', async (_label, override) => {
    const { res } = await googleCallback(goodClaims(override));
    expect(res.status).toBe(502);
    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
    expect(cookieLine(res, OAUTH_COOKIE)).toContain('Max-Age=0');
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('href="/#account"');
  });

  it('403 when the email is not on the allowlist', async () => {
    const { res } = await googleCallback(goodClaims({ email: 'stranger@example.com' }));
    expect(res.status).toBe(403);
    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
  });

  it('403 for everyone when ALLOWED_EMAILS is unset', async () => {
    const { res } = await googleCallback(goodClaims(), { env: { ...baseEnv, ALLOWED_EMAILS: undefined } });
    expect(res.status).toBe(403);
  });

  it('400 on a state mismatch, before any token exchange', async () => {
    const { res, calls } = await googleCallback(goodClaims(), { state: 'forged' });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
  });

  it('400 without the flow cookie', async () => {
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/callback/google?code=a&state=b`), baseEnv, never);
    expect(res.status).toBe(400);
  });

  it('400 for a tampered flow cookie', async () => {
    const { oauth } = await startLogin('google');
    const [, sig] = oauth.split('.');
    const forged = b64json({ provider: 'google', state: 'x', nonce: 'y', verifier: 'z', exp: NOW / 1000 + 600 });
    const { res, calls } = await googleCallback(goodClaims(), { cookie: `${forged}.${sig}`, state: 'x' });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('400 for an expired flow cookie', async () => {
    const { location, oauth } = await startLogin('google');
    const late = { fetch: tokenFetch(goodClaims()).fn, now: () => NOW + 11 * 60 * 1000 };
    const request = new Request(`${ORIGIN}/auth/callback/google?code=a&state=${location.searchParams.get('state')}`, {
      headers: { cookie: `${OAUTH_COOKIE}=${oauth}` },
    });
    expect((await handleAuthRequest(request, baseEnv, late)).status).toBe(400);
  });

  it('400 when the provider reports an error', async () => {
    const { res, calls } = await googleCallback(null, { query: 'error=access_denied&error_description=boom' });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
    expect(await res.text()).not.toContain('boom');
  });

  it('502 without echoing the provider body when the exchange fails', async () => {
    const { res } = await googleCallback(null, { status: 400 });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('provider-secret-detail');
  });

  it('502 when the token response has no id_token', async () => {
    const { res } = await googleCallback(null);
    expect(res.status).toBe(502);
  });

  it('405 for POST on the Google callback', async () => {
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/callback/google`, { method: 'POST' }), baseEnv, never);
    expect(res.status).toBe(405);
  });
});

describe('Apple callback', () => {
  async function appleCallback(claims: object, form?: Record<string, string>, token: TokenOpts = {}) {
    const { location, oauth } = await startLogin('apple');
    const { fn, calls, jwksCalls } = tokenFetch({ nonce: location.searchParams.get('nonce'), ...claims }, token);
    const body = new URLSearchParams({ code: 'apple-code', state: location.searchParams.get('state')!, ...form });
    const request = new Request(`${ORIGIN}/auth/callback/apple`, {
      method: 'POST',
      headers: { cookie: `${OAUTH_COOKIE}=${oauth}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { res: await handleAuthRequest(request, baseEnv, deps(fn)), calls, jwksCalls };
  }

  const appleClaims = (overrides: object = {}) => ({
    iss: 'https://appleid.apple.com',
    aud: 'com.paneloom.web',
    exp: NOW / 1000 + 300,
    email: 'alex.isayenko@gmail.com',
    email_verified: 'true',
    ...overrides,
  });

  it('signs in from a cross-site form POST, accepting email_verified as the string "true"', async () => {
    const { res, calls } = await appleCallback(appleClaims());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/#account');
    expect(calls[0].url).toBe('https://appleid.apple.com/auth/token');
    expect(calls[0].body.get('code')).toBe('apple-code');
    expect(calls[0].body.get('client_id')).toBe('com.paneloom.web');
    expect(calls[0].body.has('code_verifier')).toBe(false);
    const session = await readSession(
      new Request(ORIGIN, { headers: { cookie: `${SESSION_COOKIE}=${cookieValue(res, SESSION_COOKIE)}` } }),
      baseEnv,
      NOW,
    );
    expect(session).toMatchObject({ email: 'alex.isayenko@gmail.com', provider: 'apple' });
  });

  it('sends a valid ES256 client secret', async () => {
    const { calls } = await appleCallback(appleClaims());
    const jwt = calls[0].body.get('client_secret')!;
    const [head, claims, sig] = jwt.split('.');
    expect(JSON.parse(decoder.decode(base64UrlToBytes(head)))).toEqual({ alg: 'ES256', kid: 'KEY456', typ: 'JWT' });
    expect(JSON.parse(decoder.decode(base64UrlToBytes(claims)))).toEqual({
      iss: 'TEAM123',
      iat: NOW / 1000,
      exp: NOW / 1000 + 300,
      aud: 'https://appleid.apple.com',
      sub: 'com.paneloom.web',
    });
    const raw = base64UrlToBytes(sig);
    expect(raw).toHaveLength(64);
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      raw,
      encoder.encode(`${head}.${claims}`),
    );
    expect(valid).toBe(true);
  });

  it('accepts a PEM with real newlines as well as literal backslash-n', async () => {
    const real = { ...baseEnv, APPLE_PRIVATE_KEY: baseEnv.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n') };
    expect((await buildAppleClientSecret(real, NOW)).split('.')).toHaveLength(3);
    expect((await buildAppleClientSecret(baseEnv, NOW)).split('.')).toHaveLength(3);
  });

  it('rejects a boolean-false or missing email_verified', async () => {
    expect((await appleCallback(appleClaims({ email_verified: false }))).res.status).toBe(502);
    expect((await appleCallback(appleClaims({ email_verified: 'false' }))).res.status).toBe(502);
  });

  it('rejects a wrong audience and a wrong issuer', async () => {
    expect((await appleCallback(appleClaims({ aud: 'other' }))).res.status).toBe(502);
    expect((await appleCallback(appleClaims({ iss: 'https://accounts.google.com' }))).res.status).toBe(502);
  });

  it('403 for a private-relay email that is not allowlisted', async () => {
    const { res } = await appleCallback(appleClaims({ email: 'abc123@privaterelay.appleid.com' }));
    expect(res.status).toBe(403);
  });

  it('400 when Apple posts an error', async () => {
    const { res, calls } = await appleCallback(appleClaims(), { error: 'user_cancelled_authorize' });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('verifies the signature against Apple\'s keys and rejects a bad one', async () => {
    const good = await appleCallback(appleClaims());
    expect(good.res.status).toBe(303);
    expect(good.jwksCalls).toEqual([APPLE_JWKS]);
    resetJwksCache();
    const bad = await appleCallback(appleClaims(), undefined, { key: otherRsaPrivate });
    expect(bad.res.status).toBe(502);
    expect(cookieValue(bad.res, SESSION_COOKIE)).toBeUndefined();
  });

  it('405 for GET on the Apple callback', async () => {
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/callback/apple`), baseEnv, never);
    expect(res.status).toBe(405);
  });
});

describe('ID token signature (JWKS)', () => {
  it('fetches Google\'s keys once and verifies a good signature, then serves the next sign-in from cache', async () => {
    const first = await googleCallback(goodClaims());
    expect(first.res.status).toBe(303);
    expect(first.jwksCalls).toEqual([GOOGLE_JWKS]);
    const second = await googleCallback(goodClaims());
    expect(second.res.status).toBe(303);
    expect(second.jwksCalls).toEqual([]);
  });

  it('rejects a token signed by another key under a known kid, without a session', async () => {
    const { res } = await googleCallback(goodClaims(), { token: { key: otherRsaPrivate } });
    expect(res.status).toBe(502);
    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
  });

  it('rejects a token whose payload was altered after signing', async () => {
    const { location, oauth } = await startLogin('google');
    const good = await idToken({ nonce: location.searchParams.get('nonce'), ...goodClaims({ email: 'stranger@example.com' }) });
    const [head, , sig] = good.split('.');
    const forged = `${head}.${b64json({ nonce: location.searchParams.get('nonce'), ...goodClaims() })}.${sig}`;
    const fn = async (input: string) =>
      input === GOOGLE_JWKS
        ? new Response(JSON.stringify({ keys: [jwk] }))
        : new Response(JSON.stringify({ id_token: forged }));
    const res = await handleAuthRequest(
      new Request(`${ORIGIN}/auth/callback/google?code=abc&state=${location.searchParams.get('state')}`, {
        headers: { cookie: `${OAUTH_COOKIE}=${oauth}` },
      }),
      baseEnv,
      deps(fn),
    );
    expect(res.status).toBe(502);
  });

  it('refetches once on an unknown kid and accepts the rotated key', async () => {
    expect((await googleCallback(goodClaims())).res.status).toBe(303);
    const rotated = await googleCallback(goodClaims(), {
      token: { kid: 'rotated', jwks: () => [jwk, { ...jwk, kid: 'rotated' }] },
    });
    expect(rotated.res.status).toBe(303);
    expect(rotated.jwksCalls).toEqual([GOOGLE_JWKS]);
  });

  it('rejects a kid still unknown after the refetch, with a single refetch', async () => {
    const { res, jwksCalls } = await googleCallback(goodClaims(), { token: { kid: 'nobody' } });
    expect(res.status).toBe(502);
    expect(jwksCalls).toHaveLength(1);
  });

  it('rejects a valid signature with the wrong audience', async () => {
    const { res } = await googleCallback(goodClaims({ aud: 'someone-else' }));
    expect(res.status).toBe(502);
  });

  it('502 when the JWKS endpoint fails', async () => {
    const { location, oauth } = await startLogin('google');
    const token = await idToken({ nonce: location.searchParams.get('nonce'), ...goodClaims() });
    const fn = async (input: string) =>
      input === GOOGLE_JWKS ? new Response('down', { status: 500 }) : new Response(JSON.stringify({ id_token: token }));
    const res = await handleAuthRequest(
      new Request(`${ORIGIN}/auth/callback/google?code=abc&state=${location.searchParams.get('state')}`, {
        headers: { cookie: `${OAUTH_COOKIE}=${oauth}` },
      }),
      baseEnv,
      deps(fn),
    );
    expect(res.status).toBe(502);
  });

  it('rejects a JWK whose kty is not RSA', async () => {
    const { res } = await googleCallback(goodClaims(), { token: { jwks: () => [{ ...jwk, kty: 'EC' }] } });
    expect(res.status).toBe(502);
    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
  });

  it('rejects a JWK whose alg is not RS256', async () => {
    const { res } = await googleCallback(goodClaims(), { token: { jwks: () => [{ ...jwk, alg: 'RS512' }] } });
    expect(res.status).toBe(502);
    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
  });

  it('refetches once the cached keys are older than an hour', async () => {
    let fetches = 0;
    const signIn = async (now: number) => {
      const clock = { fetch: (async () => new Response('{}')) as AuthDeps['fetch'], now: () => now };
      const login = await handleAuthRequest(new Request(`${ORIGIN}/auth/login/google`), baseEnv, clock);
      const location = new URL(login.headers.get('location') ?? 'https://none.invalid/');
      const token = await idToken({
        nonce: location.searchParams.get('nonce'),
        ...goodClaims({ exp: now / 1000 + 300 }),
      });
      const fn = async (input: string) => {
        if (input === GOOGLE_JWKS) {
          fetches++;
          return new Response(JSON.stringify({ keys: [jwk] }));
        }
        return new Response(JSON.stringify({ id_token: token }));
      };
      const res = await handleAuthRequest(
        new Request(`${ORIGIN}/auth/callback/google?code=abc&state=${location.searchParams.get('state')}`, {
          headers: { cookie: `${OAUTH_COOKIE}=${cookieValue(login, OAUTH_COOKIE)}` },
        }),
        baseEnv,
        { fetch: fn, now: () => now },
      );
      return res.status;
    };
    expect(await signIn(NOW)).toBe(303);
    expect(await signIn(NOW + 59 * 60_000)).toBe(303);
    expect(fetches).toBe(1);
    expect(await signIn(NOW + 61 * 60_000)).toBe(303);
    expect(fetches).toBe(2);
  });

  it('refetches and retries when a cached key fails the signature, accepting a rotated key under the same kid', async () => {
    expect((await googleCallback(goodClaims(), { token: { jwks: () => [{ ...jwk, n: 'AQAB' }] } })).res.status).toBe(502);
    const stale = await googleCallback(goodClaims());
    expect(stale.res.status).toBe(303);
    expect(stale.jwksCalls).toEqual([GOOGLE_JWKS]);
  });

  it('does not refetch a second time when a freshly fetched key fails the signature', async () => {
    const { res, jwksCalls } = await googleCallback(goodClaims(), { token: { key: otherRsaPrivate } });
    expect(res.status).toBe(502);
    expect(jwksCalls).toHaveLength(1);
  });

  it('drops a malformed JWKS entry instead of poisoning the cache', async () => {
    const first = await googleCallback(goodClaims(), { token: { jwks: () => [null, 'x', jwk] } });
    expect(first.res.status).toBe(303);
    const second = await googleCallback(goodClaims());
    expect(second.res.status).toBe(303);
    expect(second.jwksCalls).toEqual([]);
  });

  it('rejects an algorithm other than RS256', async () => {
    const { location, oauth } = await startLogin('google');
    const forged = `${b64json({ alg: 'none', kid: KID })}.${b64json({ nonce: location.searchParams.get('nonce'), ...goodClaims() })}.`;
    const fn = async (input: string) =>
      input === GOOGLE_JWKS ? new Response(JSON.stringify({ keys: [jwk] })) : new Response(JSON.stringify({ id_token: forged }));
    const res = await handleAuthRequest(
      new Request(`${ORIGIN}/auth/callback/google?code=abc&state=${location.searchParams.get('state')}`, {
        headers: { cookie: `${OAUTH_COOKIE}=${oauth}` },
      }),
      baseEnv,
      deps(fn),
    );
    expect(res.status).toBe(502);
  });
});

describe('session', () => {
  const cookieReq = (value: string) =>
    new Request(`${ORIGIN}/auth/me`, { headers: { cookie: `a=b; ${SESSION_COOKIE}=${value}; c=d` } });

  it('round-trips and carries iat and a 30-day exp', async () => {
    const value = await signSession(baseEnv, { email: 'a@b.co', provider: 'apple' }, NOW);
    expect(await readSession(cookieReq(value), baseEnv, NOW)).toEqual({
      email: 'a@b.co',
      provider: 'apple',
      iat: NOW / 1000,
      exp: NOW / 1000 + 30 * 24 * 3600,
      oiat: NOW / 1000,
    });
  });

  it('expires after 30 days', async () => {
    const value = await signSession(baseEnv, { email: 'a@b.co', provider: 'google' }, NOW);
    expect(await readSession(cookieReq(value), baseEnv, NOW + 30 * 24 * 3600 * 1000)).toBeNull();
    expect(await readSession(cookieReq(value), baseEnv, NOW + 30 * 24 * 3600 * 1000 - 1000)).not.toBeNull();
  });

  it('rejects a tampered payload, a wrong secret and garbage', async () => {
    const value = await signSession(baseEnv, { email: 'a@b.co', provider: 'google' }, NOW);
    const [, sig] = value.split('.');
    const forged = b64json({ email: 'x@y.co', provider: 'google', iat: 1, exp: 9_999_999_999 });
    expect(await readSession(cookieReq(`${forged}.${sig}`), baseEnv, NOW)).toBeNull();
    expect(await readSession(cookieReq(value), { ...baseEnv, SESSION_SECRET: 'o'.repeat(32) }, NOW)).toBeNull();
    expect(await readSession(cookieReq('garbage'), baseEnv, NOW)).toBeNull();
    expect(await readSession(cookieReq('a.b.c'), baseEnv, NOW)).toBeNull();
    expect(await readSession(new Request(ORIGIN), baseEnv, NOW)).toBeNull();
  });

  it('authenticates nothing without SESSION_SECRET', async () => {
    const value = await signSession(baseEnv, { email: 'a@b.co', provider: 'google' }, NOW);
    expect(await readSession(cookieReq(value), { ...baseEnv, SESSION_SECRET: undefined }, NOW)).toBeNull();
  });
});

describe('session lifetime', () => {
  const DAY = 24 * 3600 * 1000;
  const cookieReq = (value: string) =>
    new Request(`${ORIGIN}/auth/me`, { headers: { cookie: `${SESSION_COOKIE}=${value}` } });
  const identity = { email: 'alex.isayenko@gmail.com', provider: 'google' } as const;

  async function legacyCookie(iat: number, exp: number): Promise<string> {
    const body = b64json({ ...identity, iat, exp });
    const key = await crypto.subtle.importKey('raw', encoder.encode(LONG_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body))));
    return `${body}.${sig}`;
  }

  async function me(value: string, now: number) {
    return handleAuthRequest(cookieReq(value), baseEnv, { fetch: async () => new Response(), now: () => now });
  }

  it('records the first issue time as oiat', async () => {
    const value = await signSession(baseEnv, identity, NOW);
    expect(await readSession(cookieReq(value), baseEnv, NOW)).toMatchObject({ iat: NOW / 1000, oiat: NOW / 1000 });
  });

  it('does not re-issue within a day', async () => {
    const value = await signSession(baseEnv, identity, NOW);
    const res = await me(value, NOW + DAY - 1000);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('re-issues on /auth/me after a day with a fresh exp and the original oiat', async () => {
    const value = await signSession(baseEnv, identity, NOW);
    const later = NOW + 2 * DAY;
    const res = await me(value, later);
    const line = cookieLine(res, SESSION_COOKIE);
    expect(line).toContain('Max-Age=2592000');
    expect(line).toContain('SameSite=Lax');
    const renewed = await readSession(cookieReq(cookieValue(res, SESSION_COOKIE)!), baseEnv, later);
    expect(renewed).toMatchObject({ iat: later / 1000, exp: later / 1000 + 30 * 24 * 3600, oiat: NOW / 1000 });
  });

  it('keeps a session alive past 30 days as long as it is used, then stops at 180 days from the first issue', async () => {
    let value = await signSession(baseEnv, identity, NOW);
    for (let day = 20; day <= 170; day += 20) {
      const res = await me(value, NOW + day * DAY);
      expect(res.status).toBe(200);
      value = cookieValue(res, SESSION_COOKIE) ?? value;
    }
    const cap = NOW + 180 * DAY;
    expect((await readSession(cookieReq(value), baseEnv, NOW + 171 * DAY))!.exp * 1000).toBe(cap);
    expect((await me(value, NOW + 172 * DAY)).headers.get('set-cookie')).toBeNull();
    expect(await readSession(cookieReq(value), baseEnv, cap - 1000)).not.toBeNull();
    expect(await readSession(cookieReq(value), baseEnv, cap)).toBeNull();
    expect((await me(value, cap)).status).toBe(401);
  });

  it('accepts an old cookie without oiat, treating iat as the origin', async () => {
    const legacy = await legacyCookie(NOW / 1000, NOW / 1000 + 30 * 24 * 3600);
    const later = NOW + 2 * DAY;
    expect(await readSession(cookieReq(legacy), baseEnv, later)).toMatchObject({ iat: NOW / 1000 });
    const res = await me(legacy, later);
    const renewed = await readSession(cookieReq(cookieValue(res, SESSION_COOKIE)!), baseEnv, later);
    expect(renewed?.oiat).toBe(NOW / 1000);
  });

  it('applies the 180-day cap to an old cookie without oiat', async () => {
    const legacy = await legacyCookie(NOW / 1000 - 181 * 24 * 3600, NOW / 1000 + 3600);
    expect(await readSession(cookieReq(legacy), baseEnv, NOW)).toBeNull();
  });

  it('never re-issues without a valid session', async () => {
    expect(await refreshedSessionCookie(new Request(ORIGIN), baseEnv, NOW)).toBeNull();
  });
});

describe('session secret length', () => {
  it('refuses to sign with a short secret', async () => {
    await expect(signSession({ SESSION_SECRET: 'x'.repeat(31) }, { email: 'a@b.co', provider: 'google' }, NOW)).rejects.toThrow();
  });

  it('never verifies a session under a short secret, even one signed with it', async () => {
    const short = 'x'.repeat(31);
    const body = b64json({ email: 'alex.isayenko@gmail.com', provider: 'google', iat: NOW / 1000, exp: NOW / 1000 + 3600 });
    const key = await crypto.subtle.importKey('raw', encoder.encode(short), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body))));
    const req = new Request(`${ORIGIN}/auth/me`, { headers: { cookie: `${SESSION_COOKIE}=${body}.${sig}` } });
    expect(await readSession(req, { ...baseEnv, SESSION_SECRET: short }, NOW)).toBeNull();
    const res = await handleAuthRequest(req, { ...baseEnv, SESSION_SECRET: short }, never);
    expect(res.status).toBe(401);
  });
});

describe('/auth/me and /auth/logout', () => {
  it('me: 403 {} when the session email is no longer allowed', async () => {
    const value = await signSession(baseEnv, { email: 'gone@b.co', provider: 'google' }, NOW);
    const res = await handleAuthRequest(
      new Request(`${ORIGIN}/auth/me`, { headers: { cookie: `${SESSION_COOKIE}=${value}` } }),
      baseEnv,
      deps(async () => new Response()),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({});
  });

  it('me: 401 lists the configured providers without a session, no-store', async () => {
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/me`), baseEnv, deps(async () => new Response()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ providers: ['google', 'apple'] });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('me: 401 lists only the providers whose secrets are set', async () => {
    const me = async (env: AuthEnv) =>
      (await handleAuthRequest(new Request(`${ORIGIN}/auth/me`), env, never)).json();
    expect(await me({ ...baseEnv, APPLE_PRIVATE_KEY: undefined })).toEqual({ providers: ['google'] });
    expect(await me({ ...baseEnv, GOOGLE_CLIENT_SECRET: undefined })).toEqual({ providers: ['apple'] });
  });

  it('me: 401 lists no providers when SESSION_SECRET is missing or short', async () => {
    const me = async (env: AuthEnv) =>
      (await handleAuthRequest(new Request(`${ORIGIN}/auth/me`), env, never)).json();
    expect(await me({ ...baseEnv, SESSION_SECRET: undefined })).toEqual({ providers: [] });
    expect(await me({ ...baseEnv, SESSION_SECRET: 'x'.repeat(31) })).toEqual({ providers: [] });
  });

  it('me: 200 with a valid session, no-store', async () => {
    const value = await signSession(baseEnv, { email: 'alex.isayenko@gmail.com', provider: 'google' }, NOW);
    const res = await handleAuthRequest(
      new Request(`${ORIGIN}/auth/me`, { headers: { cookie: `${SESSION_COOKIE}=${value}` } }),
      baseEnv,
      deps(async () => new Response()),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'alex.isayenko@gmail.com', provider: 'google' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('logout: 403 without the X-Paneloom header and keeps the cookie', async () => {
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/logout`, { method: 'POST' }), baseEnv, never);
    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it('logout: 204 and clears the session cookie', async () => {
    const res = await handleAuthRequest(
      new Request(`${ORIGIN}/auth/logout`, { method: 'POST', headers: { 'x-paneloom': '1' } }),
      baseEnv,
      never,
    );
    expect(res.status).toBe(204);
    const line = cookieLine(res, SESSION_COOKIE);
    expect(line).toContain('Max-Age=0');
    expect(line).toContain('HttpOnly');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('logout: 405 for GET', async () => {
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/logout`), baseEnv, never);
    expect(res.status).toBe(405);
  });

  it('404 for unknown /auth paths', async () => {
    const res = await handleAuthRequest(new Request(`${ORIGIN}/auth/nope`), baseEnv, never);
    expect(res.status).toBe(404);
  });
});
