export type CloudUser = { email: string; provider: string };

export type CloudProvider = 'google' | 'apple';

export type CloudSession =
  | { status: 'signedIn'; user: CloudUser }
  | { status: 'signedOut'; providers: CloudProvider[] }
  | { status: 'notAllowed' }
  | { status: 'unavailable' };

const ALL_PROVIDERS: CloudProvider[] = ['google', 'apple'];

const SIGNING_IN_KEY = 'paneloom_signing_in_v1';
const SIGNING_IN_TTL_MS = 10 * 60 * 1000;

export function loginPath(provider: CloudProvider): string {
  return `/auth/login/${provider}`;
}

async function readProviders(response: Response): Promise<CloudProvider[]> {
  try {
    const body: unknown = await response.json();
    const listed = typeof body === 'object' && body !== null ? (body as { providers?: unknown }).providers : undefined;
    return Array.isArray(listed) ? ALL_PROVIDERS.filter((provider) => listed.includes(provider)) : [];
  } catch {
    return [];
  }
}

/** Without a Worker behind the page (plain `vite dev`), /auth/me is not JSON and sign-in is unavailable. */
export async function fetchSession(): Promise<CloudSession> {
  try {
    const response = await fetch('/auth/me', { credentials: 'same-origin' });
    if (response.status === 401) return { status: 'signedOut', providers: await readProviders(response) };
    if (response.status === 403) return { status: 'notAllowed' };
    if (!response.ok) return { status: 'unavailable' };
    const body: unknown = await response.json();
    const { email, provider } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    if (typeof email !== 'string') return { status: 'unavailable' };
    return { status: 'signedIn', user: { email, provider: typeof provider === 'string' ? provider : '' } };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function signOutUser(): Promise<void> {
  const response = await fetch('/auth/logout', { method: 'POST', headers: { 'X-Paneloom': '1' }, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Sign-out failed (${response.status}).`);
}

/** Sign-in ends in a full page load, so the moment is remembered across the redirect; a failed cutover sync marks again, so the next load retries within a fresh ten minutes. */
export function markSigningIn(now: number = Date.now()): void {
  try {
    sessionStorage.setItem(SIGNING_IN_KEY, String(now));
  } catch {
    // storage unavailable: the cutover sync is skipped, never guessed
  }
}

/** True once for a sign-in started from this tab within the last ten minutes. */
export function consumeSigningIn(now: number = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(SIGNING_IN_KEY);
    if (raw === null) return false;
    sessionStorage.removeItem(SIGNING_IN_KEY);
    const startedAt = Number(raw);
    return Number.isFinite(startedAt) && now - startedAt >= 0 && now - startedAt <= SIGNING_IN_TTL_MS;
  } catch {
    return false;
  }
}
