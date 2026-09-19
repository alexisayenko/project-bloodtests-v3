import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consumeSigningIn, fetchSession, loginPath, markSigningIn, signOutUser } from '../src/cloud/session';

const fetchMock = vi.fn();
const store = new Map<string, string>();

function reply(status: number, body: unknown, ok = status >= 200 && status < 300) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: () => (body === undefined ? Promise.reject(new Error('not json')) : Promise.resolve(body)) });
}

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('fetchSession', () => {
  it('reads the signed-in user from /auth/me', async () => {
    reply(200, { email: 'a@b.c', provider: 'google' });
    expect(await fetchSession()).toEqual({ status: 'signedIn', user: { email: 'a@b.c', provider: 'google' } });
    expect(fetchMock).toHaveBeenCalledWith('/auth/me', { credentials: 'same-origin' });
  });

  it('reads a 401 as signed out', async () => {
    reply(401, { providers: ['google', 'apple'] });
    expect(await fetchSession()).toEqual({ status: 'signedOut', providers: ['google', 'apple'] });
  });

  it('keeps only the listed, known providers of a 401', async () => {
    reply(401, { providers: ['apple', 'github'] });
    expect(await fetchSession()).toEqual({ status: 'signedOut', providers: ['apple'] });
  });

  it.each([
    ['an empty object', {}],
    ['a non-array list', { providers: 'google' }],
    ['not JSON', undefined],
  ])('reads a 401 with %s as signed out with no providers', async (_label, body) => {
    reply(401, body);
    expect(await fetchSession()).toEqual({ status: 'signedOut', providers: [] });
  });

  it('reads a 403 as not allowed', async () => {
    reply(403, {});
    expect(await fetchSession()).toEqual({ status: 'notAllowed' });
  });

  it.each([
    ['a 404', () => reply(404, undefined)],
    ['a 200 that is not JSON', () => reply(200, undefined)],
    ['a 200 without an email', () => reply(200, { provider: 'apple' })],
    ['a network error', () => fetchMock.mockRejectedValueOnce(new Error('offline'))],
  ])('reports sign-in unavailable on %s', async (_label, arrange) => {
    arrange();
    expect(await fetchSession()).toEqual({ status: 'unavailable' });
  });
});

describe('signOutUser', () => {
  it('POSTs /auth/logout with the CSRF header', async () => {
    reply(204, undefined);
    await signOutUser();
    expect(fetchMock).toHaveBeenCalledWith('/auth/logout', { method: 'POST', headers: { 'X-Paneloom': '1' }, credentials: 'same-origin' });
  });

  it('throws when the Worker refuses', async () => {
    reply(403, {});
    await expect(signOutUser()).rejects.toThrow(/403/);
  });
});

describe('signing-in marker', () => {
  it('links to the Worker login routes', () => {
    expect(loginPath('google')).toBe('/auth/login/google');
    expect(loginPath('apple')).toBe('/auth/login/apple');
  });

  it('is consumed exactly once', () => {
    markSigningIn(1000);
    expect(consumeSigningIn(2000)).toBe(true);
    expect(consumeSigningIn(2000)).toBe(false);
  });

  it('can be set again after being consumed, so a failed sync retries on the next load', () => {
    markSigningIn(1000);
    expect(consumeSigningIn(2000)).toBe(true);
    markSigningIn(3000);
    expect(consumeSigningIn(4000)).toBe(true);
  });

  it('is absent without a sign-in click', () => {
    expect(consumeSigningIn()).toBe(false);
  });

  it('expires after ten minutes and is still cleared', () => {
    markSigningIn(0);
    expect(consumeSigningIn(11 * 60 * 1000)).toBe(false);
    expect(consumeSigningIn(1000)).toBe(false);
  });
});
