const GUID_RE = /^[a-f0-9-]{36}$/i;

export const IMPORTED_LINKS_KEY = 'bloodtests_imported_links_v1';

export function readSharedDataGuid(search: string): string | null {
  const value = new URLSearchParams(search).get('data');
  return value && GUID_RE.test(value) ? value : null;
}

export function isAlreadyImported(guid: string): boolean {
  try {
    const raw = localStorage.getItem(IMPORTED_LINKS_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) && list.includes(guid);
  } catch {
    return false;
  }
}

export function markImported(guid: string): void {
  try {
    const raw = localStorage.getItem(IMPORTED_LINKS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    if (!list.includes(guid)) list.push(guid);
    localStorage.setItem(IMPORTED_LINKS_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable -- the link would just be re-fetched next visit
  }
}

// Import attempts already started in this page's lifetime, keyed by guid. The
// URL param is only stripped once an import has actually succeeded, so a
// StrictMode synthetic remount re-reads the same guid; this set makes the
// second pass reuse the first pass's in-flight promise instead of starting a
// second fetch (and, more importantly, instead of losing the first one).
const inFlight = new Map<string, Promise<unknown>>();

export function fetchSharedDataOnce(guid: string): Promise<unknown> {
  const existing = inFlight.get(guid);
  if (existing) return existing;
  const p = fetchSharedData(guid);
  inFlight.set(guid, p);
  return p;
}

export function stripDataParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('data')) return;
    url.searchParams.delete('data');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // no History API -- the param just stays visible
  }
}

export async function fetchSharedData(guid: string): Promise<unknown> {
  const res = await fetch(`/d/${guid}.json`);
  if (!res.ok) throw new Error(`Shared data not available (${res.status}).`);
  return res.json();
}
