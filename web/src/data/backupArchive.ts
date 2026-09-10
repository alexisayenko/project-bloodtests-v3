import type { strToU8, zipSync } from 'fflate';
import type { DiagnosticReport } from '../types';
import type { EnvelopeMeta } from './envelopeMeta';
import { buildExportEnvelope } from '../utils/exportData';
import { LABORATORIES } from './labPricing';
import { MEDICATIONS_KEY, parseMedications } from './medications';
import { parseScheduled, SCHEDULED_KEY } from '../components/conditions/scheduled';
import { VIEW_SETTINGS_KEY } from '../components/conditions/ui';

export type StorageReader = Pick<Storage, 'getItem' | 'key' | 'length'>;
export type BackupInput = {
  sessions: DiagnosticReport[];
  meta?: EnvelopeMeta;
  storage: StorageReader;
  app: { commit: string; builtAt: string };
  now?: Date;
};

export const BACKUP_FORMAT = 'blood-tests-backup';
export const BACKUP_VERSION = 1;

const CHART_PREFIX_KEYS = ['exploreSel:', 'hpgChartView:', 'hpgAutoscale:', 'exploreEv:'];

const json = (value: unknown) => JSON.stringify(value, null, 2);

function datePart(now: Date): string {
  return now.toISOString().split('T')[0].replaceAll('-', '');
}

export function backupFilename(now = new Date()): string {
  return `blood-tests-backup-${datePart(now)}.zip`;
}

// A stored object keeps its structure; a bare flag like the chart's "1" stays
// the string it was stored as, so writing it back is JSON.stringify or as-is.
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
    if (key && (key === VIEW_SETTINGS_KEY || CHART_PREFIX_KEYS.some((prefix) => key.startsWith(prefix)))) keys.push(key);
  }
  const settings: Record<string, unknown> = {};
  for (const key of keys.sort((a, b) => a.localeCompare(b))) {
    const raw = storage.getItem(key);
    if (raw !== null) settings[key] = storedValue(raw);
  }
  return settings;
}

export async function buildBackupFiles({ sessions, meta, storage, app, now = new Date() }: BackupInput): Promise<Record<string, string>> {
  const content: Record<string, string> = {
    'lab-reports.json': json(await buildExportEnvelope(sessions, meta)),
    'medications.json': json(parseMedications(storage.getItem(MEDICATIONS_KEY), now.getFullYear())),
    'scheduled-visits.json': json(parseScheduled(storage.getItem(SCHEDULED_KEY))),
    'laboratory-prices.json': json(LABORATORIES),
    'settings.json': json(readSettings(storage)),
  };
  const manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    app,
    files: Object.keys(content),
  };
  return { 'manifest.json': json(manifest), ...content };
}

export function zipBackupFiles(files: Record<string, string>, fflate: { zipSync: typeof zipSync; strToU8: typeof strToU8 }): Uint8Array {
  return fflate.zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, fflate.strToU8(text)])));
}
