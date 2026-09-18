import { BACKUP_FORMAT, BACKUP_VERSION } from '../data/backupArchive';
import { mergeFilesToLabReports, splitReportsToFiles } from '../data/reportFiles';
import { supabaseClient } from './config';

const API_PATH = '/api/data';
const BASELINE_KEY = 'paneloom_cloud_baseline_v1';
const PASSTHROUGH_FILES = ['medications.json', 'scheduled-visits.json', 'settings.json'];
const REPORTS_FILE = 'lab-reports.json';
const MANIFEST_FILE = 'manifest.json';

type Baseline = { digest: string; manifest: string };

async function request(method: 'GET' | 'PUT', files?: Record<string, string>): Promise<Record<string, unknown>> {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  const response = await fetch(API_PATH, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(files && { 'Content-Type': 'application/json' }) },
    body: files ? JSON.stringify({ files }) : undefined,
  });
  const body: unknown = await response.json().catch(() => ({}));
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (!response.ok) throw new Error(`Cloud request failed (${response.status}): ${String(record.error ?? response.statusText)}`);
  return record;
}

async function digestOf(files: Record<string, string>): Promise<string> {
  const entries = Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1));
  const bytes = new TextEncoder().encode(JSON.stringify(entries));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

function loadBaseline(): Baseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed === 'object' && parsed !== null) {
      const { digest, manifest } = parsed as Record<string, unknown>;
      if (typeof digest === 'string' && typeof manifest === 'string') return { digest, manifest };
    }
  } catch {
    // corrupt or unavailable storage reads as no baseline
  }
  return null;
}

function saveBaseline(baseline: Baseline | null): void {
  try {
    if (baseline) localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
    else localStorage.removeItem(BASELINE_KEY);
  } catch {
    // storage unavailable
  }
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

function derivedManifest(files: Record<string, string>): string {
  return JSON.stringify(
    { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), files: Object.keys(files) },
    null,
    2
  );
}

/** Null when the cloud folder holds no reports, medications or visits. */
export async function pullCloudFiles(): Promise<Record<string, string> | null> {
  const body = await request('GET');
  const cloud = (body.files ?? {}) as Record<string, string>;
  if (!hasUserData(cloud)) {
    saveBaseline(null);
    return null;
  }

  const content: Record<string, string> = {};
  const reports = await mergeFilesToLabReports(cloud);
  if (reports !== null) content[REPORTS_FILE] = reports;
  for (const name of PASSTHROUGH_FILES) if (cloud[name] !== undefined) content[name] = cloud[name];

  const { [MANIFEST_FILE]: cloudManifest, ...payload } = cloud;
  const manifest = cloudManifest ?? derivedManifest(content);
  saveBaseline({ digest: await digestOf(payload), manifest });
  return { [MANIFEST_FILE]: manifest, ...content };
}

/**
 * The manifest carries a timestamp, so it is resent verbatim while nothing else
 * differs from what was last pulled or pushed; otherwise every push would commit.
 * Returns false, sending nothing, when there is no user data: the Worker rejects empty writes.
 */
export async function pushCloudFiles(files: Record<string, string>): Promise<boolean> {
  const payload: Record<string, string> = files[REPORTS_FILE] === undefined ? {} : await splitReportsToFiles(files[REPORTS_FILE]);
  for (const name of PASSTHROUGH_FILES) if (files[name] !== undefined) payload[name] = files[name];

  if (!hasUserData(payload)) return false;

  const digest = await digestOf(payload);
  const baseline = loadBaseline();
  const manifest = baseline?.digest === digest ? baseline.manifest : (files[MANIFEST_FILE] ?? derivedManifest(payload));

  await request('PUT', { ...payload, [MANIFEST_FILE]: manifest });
  saveBaseline({ digest, manifest });
  return true;
}
