import { readBackup, type BackupContents } from '../data/backupRestore';
import { localFileStates, manifestText } from '../data/backupArchive';
import { isReportPath } from '../data/reportFiles';
import { loadHeldFiles, NO_PENDING, payloadDigest, saveHeldFiles, type PendingChanges } from '../data/storage/heldFiles';

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

const OTHER_FILES = ['medications.json', 'scheduled-visits.json', 'settings.json'];
const REPORT_EDITABLE_KEYS = new Set(['value', 'rawValue']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What the user changed in this browser since the last pull or push; the only things a push may send.
 * `untracked` names local files no import or pull ever recorded (a cache from before held files): their
 * content is of unknown origin, so it is never sent and never wiped.
 */
export type PushChanges = PendingChanges & { untracked?: string[] };

export function pendingChanges(storage: Pick<Storage, 'getItem' | 'key' | 'length'> = localStorage, now = new Date()): PushChanges {
  const held = loadHeldFiles();
  const states = localFileStates(storage, now);
  const drifted = OTHER_FILES.filter((name) => name in held.state && held.state[name] !== states[name]);
  const untracked = OTHER_FILES.filter((name) => !(name in held.state));
  return { ...held.pending, other: [...new Set([...held.pending.other, ...drifted])], untracked };
}

function parseRecord(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function keepsKeys(before: Record<string, unknown>, after: Record<string, unknown>, editable: ReadonlySet<string> = new Set()): boolean {
  return Object.keys(before).every((key) => key in after || editable.has(key));
}

function keepsObservations(before: unknown, after: unknown): boolean {
  if (!Array.isArray(before)) return true;
  if (!Array.isArray(after) || after.length < before.length) return false;
  return before.every((obs, i) => !isRecord(obs) || (isRecord(after[i]) && keepsKeys(obs, after[i], REPORT_EDITABLE_KEYS)));
}

/**
 * The last line against a lossy write: a rewritten report file must describe the same reports and keep every
 * field the stored one had, except the two an edit may clear. Anything else (a file rebuilt from the parsed model,
 * a different report under a taken name) is not sent.
 */
export function keepsStoredFields(storedText: string, nextText: string): boolean {
  const stored = parseRecord(storedText);
  const next = parseRecord(nextText);
  if (!stored || !next || !keepsKeys(stored, next)) return false;
  const before = Array.isArray(stored.diagnosticReports) ? stored.diagnosticReports : [];
  const after = Array.isArray(next.diagnosticReports) ? next.diagnosticReports : [];
  if (before.length !== after.length) return false;
  return before.every((report, i) => {
    const other = after[i];
    if (!isRecord(report) || !isRecord(other)) return false;
    return (
      report.lab === other.lab &&
      report.collectedAt === other.collectedAt &&
      keepsKeys(report, other) &&
      keepsObservations(report.observations, other.observations)
    );
  });
}

export type PushPlan = {
  files: Record<string, string>;
  /** Changed report files not sent because they would lose stored fields. */
  skipped: string[];
  /** Local data the cloud has no copy of and the user did not change: not sent, so not safe to wipe. */
  unsent: string[];
};

/**
 * The cloud folder with only the user's own changes laid over it. Every other file keeps the text the cloud
 * holds, whatever this browser's copy looks like.
 */
export function planPush(cloud: Record<string, string>, local: Record<string, string>, changes: PushChanges): PushPlan {
  const { [MANIFEST_FILE]: cloudManifest, ...stored } = cloud;
  void cloudManifest;
  const files = { ...stored };
  const skipped: string[] = [];
  const unsent: string[] = [];
  for (const path of changes.reports) {
    const text = local[path];
    if (text === undefined) continue;
    const before = stored[path];
    if (before === undefined) files[path] = text;
    else if (before !== text) {
      if (keepsStoredFields(before, text)) files[path] = text;
      else skipped.push(path);
    }
  }
  for (const path of changes.removed) if (local[path] === undefined) delete files[path];
  for (const name of OTHER_FILES) {
    const text = local[name];
    if (text === undefined || text === stored[name]) continue;
    if (changes.other.includes(name)) files[name] = text;
    else if (changes.untracked?.includes(name)) unsent.push(name);
  }
  for (const path of Object.keys(local)) {
    if (isReportPath(path) && stored[path] === undefined && !changes.reports.includes(path)) unsent.push(path);
  }
  return { files, skipped, unsent };
}

function sameFiles(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function manifestApp(manifest: string | undefined): { commit: string; builtAt: string } {
  const app = manifest === undefined ? null : parseRecord(manifest)?.app;
  return isRecord(app) ? { commit: String(app.commit ?? ''), builtAt: String(app.builtAt ?? '') } : { commit: '', builtAt: '' };
}

// The pushed files become the held ones, so what this browser keeps is what the cloud now holds.
function rememberPushed(pushed: Record<string, string>, now: Date): void {
  try {
    const held = loadHeldFiles();
    const states = localFileStates(localStorage, now);
    const other = { ...held.other };
    const state = { ...held.state };
    for (const name of OTHER_FILES) {
      if (pushed[name] === undefined) continue;
      other[name] = pushed[name];
      state[name] = states[name];
    }
    const reports = { ...held.reports };
    for (const [path, text] of Object.entries(pushed)) if (isReportPath(path) && path in reports) reports[path] = text;
    const { [MANIFEST_FILE]: manifest, ...payload } = pushed;
    saveHeldFiles({
      ...held,
      reports,
      other,
      state,
      pending: NO_PENDING,
      ...(manifest !== undefined && { manifest, digest: payloadDigest(payload) }),
    });
  } catch {
    // storage full or unavailable: the next push finds the same changes still pending
  }
}

export type PushResult = { sent: boolean; skipped: string[]; unsent: string[] };

/**
 * Sends the user's own changes over what the cloud holds (ADR-0028). An empty cloud takes the local set as
 * it is. Otherwise the cloud is read first and only pending files go over it, each kept lossless; with
 * nothing to change nothing is sent. Returns sent false, sending nothing, when there is no user data.
 */
export async function pushCloudFiles(local: Record<string, string>, changes: PushChanges, now = new Date()): Promise<PushResult> {
  if (!hasUserData(local)) return { sent: false, skipped: [], unsent: [] };
  const cloud = ((await request('GET')).files ?? {}) as Record<string, string>;
  if (!hasUserData(cloud)) {
    await request('PUT', local);
    rememberPushed(local, now);
    return { sent: true, skipped: [], unsent: [] };
  }
  const plan = planPush(cloud, local, changes);
  const { [MANIFEST_FILE]: cloudManifest, ...stored } = cloud;
  if (sameFiles(plan.files, stored)) return { sent: false, skipped: plan.skipped, unsent: plan.unsent };
  const manifest = manifestText(plan.files, manifestApp(local[MANIFEST_FILE] ?? cloudManifest), now);
  const outgoing = { [MANIFEST_FILE]: manifest, ...plan.files };
  await request('PUT', outgoing);
  rememberPushed(outgoing, now);
  return { sent: true, skipped: plan.skipped, unsent: plan.unsent };
}

// An empty local backup never overwrites a populated cloud document.
export function isEmptyBackup(backup: BackupContents): boolean {
  return !backup.reports?.count && !backup.medications?.rows.length && !backup.scheduled?.visits.length;
}

export type SignInSync = 'pulled' | 'pushed' | 'unchanged';

/**
 * The sign-in cutover (ADR-0018). A cloud folder with data replaces what is held here, file for file, and
 * leaves nothing to push. Only an empty cloud is filled from local.
 */
export async function syncOnSignIn(
  localFiles: () => Record<string, string>,
  importAll: (backup: BackupContents, options: { fromCloud: true }) => Promise<unknown>
): Promise<SignInSync> {
  const cloudFiles = await pullCloudFiles();
  const backup = cloudFiles ? readBackup(cloudFiles, { manifestOptional: true }) : null;
  if (backup && !isEmptyBackup(backup)) {
    await importAll(backup, { fromCloud: true });
    return 'pulled';
  }
  return (await pushCloudFiles(localFiles(), pendingChanges())).sent ? 'pushed' : 'unchanged';
}

export type SignOutSave = 'saved' | 'auth' | 'kept' | 'failed';

function isAuthFailure(error: unknown): boolean {
  return error instanceof CloudRequestError && (error.status === 401 || error.status === 403);
}

/**
 * 'saved': the cloud holds everything local has (pushed, or nothing needed pushing, or local is empty so
 * nothing can be lost). 'kept': some local data could not be sent safely, so it must stay on this device.
 * 'auth': the cloud answered 401/403, so the session is dead and nothing was saved. 'failed': any other
 * error. The caller may wipe local data only on 'saved'.
 */
export async function pushBeforeSignOut(localFiles: Record<string, string>, changes: PushChanges): Promise<SignOutSave> {
  if (isEmptyBackup(readBackup(localFiles))) return 'saved';
  try {
    const result = await pushCloudFiles(localFiles, changes);
    if (result.skipped.length > 0 || result.unsent.length > 0) return 'kept';
    return 'saved';
  } catch (error) {
    return isAuthFailure(error) ? 'auth' : 'failed';
  }
}
