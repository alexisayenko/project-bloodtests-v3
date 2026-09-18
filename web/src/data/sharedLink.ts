import { hasStoredResults } from './storage/resultsStorage';
import { parseSharedMeta, type SharedMeta } from './sharedMeta';

export type SharedPayload = { data: unknown; meta: SharedMeta | null };

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
    if (!Array.isArray(list) || !list.includes(guid)) return false;
    return hasStoredResults();
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
    // storage unavailable
  }
}

// The URL param is stripped only after a successful import, so a StrictMode
// remount re-reads the guid; it must reuse the in-flight promise, not lose it.
const inFlight = new Map<string, Promise<SharedPayload>>();

export function fetchSharedDataOnce(guid: string): Promise<SharedPayload> {
  const existing = inFlight.get(guid);
  if (existing) return existing;
  const p = fetchSharedPayload(guid);
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
    // no History API
  }
}

export async function fetchSharedData(guid: string): Promise<unknown> {
  const res = await fetch(`/d/${guid}.data.json`);
  if (!res.ok) throw new Error(`Shared data not available (${res.status}).`);
  return res.json();
}

// A missing, non-200 or unparsable meta means "no meta" and never fails the import.
export async function fetchSharedMeta(guid: string): Promise<SharedMeta | null> {
  try {
    const res = await fetch(`/d/${guid}.meta.json`);
    if (!res.ok) return null;
    return parseSharedMeta(await res.json());
  } catch {
    return null;
  }
}

async function fetchSharedPayload(guid: string): Promise<SharedPayload> {
  const [data, meta] = await Promise.all([fetchSharedData(guid), fetchSharedMeta(guid)]);
  return { data, meta };
}
