import type { strFromU8, unzipSync } from 'fflate';
import { BACKUP_FORMAT, BACKUP_VERSION, USER_DATA_KEYS, isSettingsKey, isUserDataKey, localFileStates } from './backupArchive';
import { saveEnvelopeMeta } from './envelopeMeta';
import { isAcceptedSchemaVersion } from './envelopeSchema';
import { isMedicationsShape, parseMedications, saveMedications, type Medications } from './storage/medications';
import { parseUploadedResults, UploadParseError } from './parseUpload';
import { filesFromUpload, isReportPath } from './reportFiles';
import { loadHeldFiles, payloadDigest, saveHeldFiles } from './storage/heldFiles';
import { clearSharedMeta } from './sharedMeta';
import { isScheduledShape, parseScheduled, saveScheduled, type ScheduledVisits } from './storage/scheduledVisits';
import { saveViewSettings, VIEW_SETTINGS_KEY, type ViewSettings } from './storage/viewSettings';

export class BackupImportError extends Error {}

const LOCAL_FILE_NAMES = ['medications.json', 'scheduled-visits.json', 'settings.json'];

export type BackupContents = {
  // Per-report files, verbatim (a legacy lab-reports.json is split into new ones).
  reports?: { files: Record<string, string>; count: number; sex?: 'female' | 'male' };
  medications?: Medications;
  scheduled?: ScheduledVisits;
  settings?: Record<string, unknown>;
  // The texts of medications.json, scheduled-visits.json and settings.json as they came in.
  other: Record<string, string>;
  manifest?: string;
  hasLaboratoryPrices: boolean;
};

export type RestoreDeps = {
  clearReports: () => void;
  importReports: (files: Record<string, string>) => Promise<void> | void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function unzipBackup(zip: Uint8Array, fflate: { unzipSync: typeof unzipSync; strFromU8: typeof strFromU8 }): Record<string, string> {
  try {
    const entries = fflate.unzipSync(zip);
    return Object.fromEntries(
      Object.entries(entries)
        .filter(([name]) => !name.endsWith('/'))
        .map(([name, bytes]) => [name, fflate.strFromU8(bytes)])
    );
  } catch {
    throw new BackupImportError('That file is not a zip archive.');
  }
}

function parsePart(files: Record<string, string>, name: string): unknown {
  try {
    return JSON.parse(files[name]);
  } catch {
    throw new BackupImportError(`${name} is not valid JSON.`);
  }
}

function isEmptyEnvelope(envelope: unknown): boolean {
  // An empty envelope is rejected by the upload parser but is a valid backup of nothing.
  return (
    isRecord(envelope) &&
    isAcceptedSchemaVersion(envelope.schema) &&
    Array.isArray(envelope.diagnosticReports) &&
    envelope.diagnosticReports.length === 0
  );
}

function countReports(envelope: unknown, name: string, sourcePath?: string): number {
  if (isEmptyEnvelope(envelope)) return 0;
  try {
    return parseUploadedResults(envelope, sourcePath).length;
  } catch (e) {
    throw new BackupImportError(`${name}: ${e instanceof UploadParseError ? e.message : 'could not be read.'}`);
  }
}

function readStoredReports(files: Record<string, string>, paths: string[]): BackupContents['reports'] {
  const kept: Record<string, string> = {};
  let count = 0;
  let sex: 'female' | 'male' | undefined;
  for (const path of paths) {
    const envelope = parsePart(files, path);
    const n = countReports(envelope, path, path);
    if (n === 0) continue;
    kept[path] = files[path];
    count += n;
    const printed = (envelope as Record<string, unknown>).sex;
    if (sex === undefined && (printed === 'female' || printed === 'male')) sex = printed;
  }
  return { files: kept, count, ...(sex && { sex }) };
}

function readLegacyReports(files: Record<string, string>): BackupContents['reports'] {
  const text = files['lab-reports.json'];
  if (text === undefined) return undefined;
  const envelope = parsePart(files, 'lab-reports.json');
  const count = countReports(envelope, 'lab-reports.json');
  if (count === 0) return { files: {}, count: 0 };
  const printed = (envelope as Record<string, unknown>).sex;
  return {
    files: filesFromUpload(envelope as Record<string, unknown>, text, new Set(), new Date()),
    count,
    ...((printed === 'female' || printed === 'male') && { sex: printed }),
  };
}

function readReports(files: Record<string, string>): BackupContents['reports'] {
  const paths = Object.keys(files).filter(isReportPath).sort((a, b) => (a < b ? -1 : 1));
  return paths.length > 0 ? readStoredReports(files, paths) : readLegacyReports(files);
}

function readSettings(files: Record<string, string>): BackupContents['settings'] {
  if (files['settings.json'] === undefined) return undefined;
  const settings = parsePart(files, 'settings.json');
  if (!isRecord(settings)) throw new BackupImportError('settings.json is not an object.');
  for (const [key, value] of Object.entries(settings)) {
    const valid =
      key === VIEW_SETTINGS_KEY
        ? isRecord(value)
        : isSettingsKey(key) && (typeof value === 'string' || (typeof value === 'object' && value !== null));
    if (!valid) throw new BackupImportError(`settings.json has an unexpected entry "${key}".`);
  }
  return settings;
}

/**
 * Validates every part without touching storage, so a bad file changes nothing. A cloud folder is
 * read with `manifestOptional`: it need not carry a manifest.
 */
export function readBackup(files: Record<string, string>, { manifestOptional = false } = {}): BackupContents {
  let manifest: string | undefined;
  if (files['manifest.json'] === undefined) {
    if (!manifestOptional) throw new BackupImportError('The zip has no manifest.json, so it is not a blood tests backup.');
  } else {
    const parsed = parsePart(files, 'manifest.json');
    if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION || !Array.isArray(parsed.files)) {
      throw new BackupImportError(`manifest.json is not a ${BACKUP_FORMAT} version ${BACKUP_VERSION} manifest.`);
    }
    manifest = files['manifest.json'];
  }

  const reports = readReports(files);
  const contents: BackupContents = { hasLaboratoryPrices: false, reports, settings: readSettings(files), other: {} };
  // A manifest listing lab-reports.json describes a layout that is not the one held.
  const legacy = files['lab-reports.json'] !== undefined && !Object.keys(files).some(isReportPath);
  if (manifest !== undefined && !legacy) contents.manifest = manifest;
  for (const name of LOCAL_FILE_NAMES) if (files[name] !== undefined) contents.other[name] = files[name];

  if (files['medications.json'] !== undefined) {
    if (!isMedicationsShape(parsePart(files, 'medications.json'))) {
      throw new BackupImportError('medications.json does not hold a medication history.');
    }
    contents.medications = parseMedications(files['medications.json'], new Date().getFullYear());
  }
  if (files['scheduled-visits.json'] !== undefined) {
    if (!isScheduledShape(parsePart(files, 'scheduled-visits.json'))) {
      throw new BackupImportError('scheduled-visits.json does not hold a schedule.');
    }
    contents.scheduled = parseScheduled(files['scheduled-visits.json']);
  }
  if (files['laboratory-prices.json'] !== undefined) {
    parsePart(files, 'laboratory-prices.json');
    contents.hasLaboratoryPrices = true;
  }
  return contents;
}

function storedUserDataKeys(): string[] {
  const keys = new Set<string>(USER_DATA_KEYS);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && isUserDataKey(key)) keys.add(key);
    }
  } catch {
    // storage unavailable
  }
  return [...keys];
}

export function clearAllData(clearReports: () => void): void {
  clearReports();
  clearSharedMeta();
  for (const key of storedUserDataKeys()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage unavailable
    }
  }
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function restoreReports(reports: BackupContents['reports'], importReports: RestoreDeps['importReports']): Promise<string> {
  if (!reports) return 'Lab reports: not in the backup, left empty.';
  if (reports.count > 0) await importReports(reports.files);
  if (reports.sex) saveEnvelopeMeta({ sex: reports.sex });
  return `Lab reports: ${count(reports.count, 'report', 'reports')} restored.`;
}

function restoreMedications(medications: BackupContents['medications']): string {
  if (!medications) return 'Medications: not in the backup, left empty.';
  saveMedications(medications);
  return `Medications: ${count(medications.rows.length, 'row', 'rows')} restored.`;
}

function restoreScheduled(scheduled: BackupContents['scheduled']): string {
  if (!scheduled) return 'Scheduled visits: not in the backup, left empty.';
  saveScheduled(scheduled);
  const loincs = scheduled.visits.reduce((n, v) => n + v.loincs.length, 0);
  const indices = scheduled.visits.reduce((n, v) => n + v.indices.length, 0);
  return `Scheduled visits: ${count(scheduled.visits.length, 'visit', 'visits')} with ${count(loincs, 'observation', 'observations')} and ${count(indices, 'index', 'indices')} restored.`;
}

function restoreSetting(key: string, value: unknown): void {
  if (key === VIEW_SETTINGS_KEY) {
    saveViewSettings(value as ViewSettings);
    return;
  }
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // storage unavailable
  }
}

function restoreSettings(settings: BackupContents['settings']): string {
  if (!settings) return 'Settings: not in the backup, left at defaults.';
  for (const [key, value] of Object.entries(settings)) restoreSetting(key, value);
  return `Settings: ${count(Object.keys(settings).length, 'entry', 'entries')} restored.`;
}

function laboratoryPricesLine(hasLaboratoryPrices: boolean): string {
  return hasLaboratoryPrices
    ? 'Laboratory prices: not restored; the prices that ship with the app are used.'
    : 'Laboratory prices: ship with the app, nothing to restore.';
}

// The texts are what export sends back; `state` lets it tell them from a later local change.
function holdFiles(backup: BackupContents): void {
  const held = loadHeldFiles();
  saveHeldFiles({
    reports: held.reports,
    other: backup.other,
    state: localFileStates(localStorage, new Date()),
    ...(backup.manifest !== undefined && {
      manifest: backup.manifest,
      digest: payloadDigest({ ...backup.reports?.files, ...backup.other }),
    }),
  });
}

/** Returns one report line per part. */
export async function restoreBackup(backup: BackupContents, deps: RestoreDeps): Promise<string[]> {
  clearAllData(deps.clearReports);
  const reportsLine = await restoreReports(backup.reports, deps.importReports);
  const lines = [
    reportsLine,
    restoreMedications(backup.medications),
    restoreScheduled(backup.scheduled),
    restoreSettings(backup.settings),
    laboratoryPricesLine(backup.hasLaboratoryPrices),
  ];
  holdFiles(backup);
  return lines;
}
