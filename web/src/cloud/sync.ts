import { readBackup, type BackupContents } from '../data/backupRestore';
import { loadHeldFiles, payloadDigest, saveHeldFiles } from '../data/storage/heldFiles';

const API_PATH = '/api/data';
const MANIFEST_FILE = 'manifest.json';

export class CloudRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(method: 'GET' | 'PUT', files?: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(API_PATH, {
    method,
    credentials: 'same-origin',
    headers: files ? { 'X-Paneloom': '1', 'Content-Type': 'application/json' } : {},
    body: files ? JSON.stringify({ files }) : undefined,
  });
  const body: unknown = await response.json().catch(() => ({}));
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (!response.ok) throw new CloudRequestError(response.status, `Cloud request failed (${response.status}): ${String(record.error ?? response.statusText)}`);
  return record;
}

function rowCount(text: string | undefined, field: 'rows' | 'visits'): number {
  if (text === undefined) return 0;
  try {
    const rows = (JSON.parse(text) as Record<string, unknown> | null)?.[field];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

// Settings and the manifest alone never make a folder worth restoring or writing.
function hasUserData(files: Record<string, string>): boolean {
  return (
    Object.keys(files).some((name) => name.startsWith('reports/')) ||
    rowCount(files['medications.json'], 'rows') > 0 ||
    rowCount(files['scheduled-visits.json'], 'visits') > 0
  );
}

/** The cloud folder as stored, file for file. Null when it holds no reports, medications or visits. */
export async function pullCloudFiles(): Promise<Record<string, string> | null> {
  const body = await request('GET');
  const cloud = (body.files ?? {}) as Record<string, string>;
  return hasUserData(cloud) ? cloud : null;
}

// The manifest carries a timestamp: remembering it with the payload it described lets an
// unchanged payload resend it verbatim, so a push with no edits commits nothing.
function rememberManifest(files: Record<string, string>): void {
  const { [MANIFEST_FILE]: manifest, ...payload } = files;
  if (manifest === undefined) return;
  try {
    saveHeldFiles({ ...loadHeldFiles(), manifest, digest: payloadDigest(payload) });
  } catch {
    // storage full or unavailable: the next push writes a fresh manifest
  }
}

/**
 * Sends the files exactly as built: report texts are the stored ones, never rebuilt.
 * Returns false, sending nothing, when there is no user data: the Worker rejects empty writes.
 */
export async function pushCloudFiles(files: Record<string, string>): Promise<boolean> {
  if (!hasUserData(files)) return false;
  await request('PUT', files);
  rememberManifest(files);
  return true;
}

// An empty local backup never overwrites a populated cloud document.
export function isEmptyBackup(backup: BackupContents): boolean {
  return !backup.reports?.count && !backup.medications?.rows.length && !backup.scheduled?.visits.length;
}

export type SignOutSave = 'saved' | 'auth' | 'failed';

function isAuthFailure(error: unknown): boolean {
  return error instanceof CloudRequestError && (error.status === 401 || error.status === 403);
}

/**
 * 'saved': the push succeeded, or local is empty so nothing can be lost (an empty local set is never
 * pushed over the cloud). 'auth': the cloud answered 401/403, so the session is dead and nothing was
 * saved. 'failed': any other error, or a push that sent nothing. The caller may wipe local data only on 'saved'.
 */
export async function pushBeforeSignOut(localFiles: Record<string, string>): Promise<SignOutSave> {
  if (isEmptyBackup(readBackup(localFiles))) return 'saved';
  try {
    return (await pushCloudFiles(localFiles)) ? 'saved' : 'failed';
  } catch (error) {
    return isAuthFailure(error) ? 'auth' : 'failed';
  }
}
