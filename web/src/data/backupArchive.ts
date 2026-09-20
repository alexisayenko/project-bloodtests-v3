import type { strToU8, zipSync } from 'fflate';
import type { DiagnosticReport } from '../types';
import { ENVELOPE_META_KEY } from './envelopeMeta';
import { resolveReportFiles } from './reportFiles';
import { HELD_FILES_KEY, parseHeldFiles, payloadDigest } from './storage/heldFiles';
import { MEDICATIONS_KEY, parseMedications } from './storage/medications';
import { RESULTS_STORAGE_KEY } from './storage/resultsStorage';
import { SHARED_META_KEY } from './sharedMeta';
import { IMPORTED_LINKS_KEY } from './sharedLink';
import { parseScheduled, SCHEDULED_KEY } from './storage/scheduledVisits';
import { VIEW_SETTINGS_KEY } from './storage/viewSettings';
import { SIDEBAR_COLLAPSED_KEY } from './storage/sidebarCollapsed';

export type StorageReader = Pick<Storage, 'getItem' | 'key' | 'length'>;
export type BackupInput = {
  sessions: DiagnosticReport[];
  storage: StorageReader;
  app: { commit: string; builtAt: string };
  now?: Date;
};

export const BACKUP_FORMAT = 'blood-tests-backup';
export const BACKUP_VERSION = 1;

export const CHART_PREFIX_KEYS = ['exploreSel:', 'hpgChartView:', 'hpgAutoscale:', 'exploreEv:'];

// The one list export, clear and import all read.
export const USER_DATA_KEYS = [
  RESULTS_STORAGE_KEY,
  HELD_FILES_KEY,
  ENVELOPE_META_KEY,
  MEDICATIONS_KEY,
  SCHEDULED_KEY,
  VIEW_SETTINGS_KEY,
  SHARED_META_KEY,
  IMPORTED_LINKS_KEY,
  SIDEBAR_COLLAPSED_KEY,
];

export function isSettingsKey(key: string): boolean {
  return key === VIEW_SETTINGS_KEY || CHART_PREFIX_KEYS.some((prefix) => key.startsWith(prefix));
}

export function isUserDataKey(key: string): boolean {
  return USER_DATA_KEYS.includes(key) || isSettingsKey(key);
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

function datePart(now: Date): string {
  return now.toISOString().split('T')[0].replaceAll('-', '');
}

export function backupFilename(now = new Date()): string {
  return `blood-tests-backup-${datePart(now)}.zip`;
}

// A bare flag like the chart's "1" stays the string it was stored as.
function storedValue(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : raw;
  } catch {
    return raw;
  }
}

function readSettings(storage: StorageReader): Record<string, unknown> {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isSettingsKey(key)) keys.push(key);
  }
  keys.sort((a, b) => a.localeCompare(b));
  const settings: Record<string, unknown> = {};
  for (const key of keys) {
    const raw = storage.getItem(key);
    if (raw !== null) settings[key] = storedValue(raw);
  }
  return settings;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : 1)))
      : v
  );
}

// The files kept in their own localStorage keys. `state` is a key-order-independent reading of the
// local content (null when nothing is stored); `rebuild` is only used once that content has changed.
const LOCAL_FILES = [
  {
    name: 'medications.json',
    state: (storage: StorageReader, now: Date) => {
      const raw = storage.getItem(MEDICATIONS_KEY);
      return raw === null ? null : canonical(parseMedications(raw, now.getFullYear()));
    },
    rebuild: (storage: StorageReader, now: Date) => json(parseMedications(storage.getItem(MEDICATIONS_KEY), now.getFullYear())),
  },
  {
    name: 'scheduled-visits.json',
    state: (storage: StorageReader) => {
      const raw = storage.getItem(SCHEDULED_KEY);
      return raw === null ? null : canonical(parseScheduled(raw));
    },
    rebuild: (storage: StorageReader) => json(parseScheduled(storage.getItem(SCHEDULED_KEY))),
  },
  {
    name: 'settings.json',
    state: (storage: StorageReader) => {
      const settings = readSettings(storage);
      return Object.keys(settings).length === 0 ? null : canonical(settings);
    },
    rebuild: (storage: StorageReader) => json(readSettings(storage)),
  },
];

export function localFileStates(storage: StorageReader, now: Date): Record<string, string | null> {
  return Object.fromEntries(LOCAL_FILES.map((file) => [file.name, file.state(storage, now)]));
}

/** A file the import held keeps its text while the local content still matches; empty and never held is left out. */
function localFiles(storage: StorageReader, held: ReturnType<typeof parseHeldFiles>, now: Date): Record<string, string> {
  const files: Record<string, string> = {};
  for (const file of LOCAL_FILES) {
    const text = held.other[file.name];
    const state = file.state(storage, now);
    if (text !== undefined && held.state[file.name] === state) files[file.name] = text;
    else if (state !== null || text !== undefined) files[file.name] = file.rebuild(storage, now);
  }
  return files;
}

export function manifestText(payload: Record<string, string>, app: BackupInput['app'], now: Date): string {
  return json({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), app, files: Object.keys(payload) });
}

/**
 * Exactly the stored layout: one file per report, held texts unchanged, plus the three local files and a manifest.
 * The held manifest is reused while the payload is unchanged, so an untouched round trip is byte-identical.
 */
export function buildBackupFiles({ sessions, storage, app, now = new Date() }: BackupInput): Record<string, string> {
  const held = parseHeldFiles(storage.getItem(HELD_FILES_KEY));
  const payload = { ...resolveReportFiles(sessions, held.reports, now).files, ...localFiles(storage, held, now) };
  const manifest =
    held.manifest !== undefined && held.digest === payloadDigest(payload)
      ? held.manifest
      : manifestText(payload, app, now);
  return { 'manifest.json': manifest, ...payload };
}

export function zipBackupFiles(files: Record<string, string>, fflate: { zipSync: typeof zipSync; strToU8: typeof strToU8 }): Uint8Array {
  return fflate.zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, fflate.strToU8(text)])));
}
