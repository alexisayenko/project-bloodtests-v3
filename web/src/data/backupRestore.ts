import type { strFromU8, unzipSync } from 'fflate';
import { BACKUP_FORMAT, BACKUP_VERSION, USER_DATA_KEYS, isSettingsKey, isUserDataKey } from './backupArchive';
import { sanitizeEnvelopeMeta, saveEnvelopeMeta, type EnvelopeMeta } from './envelopeMeta';
import { isAcceptedSchemaVersion } from './envelopeSchema';
import { isMedicationsShape, parseMedications, saveMedications, type Medications } from './medications';
import { parseUploadedResults, UploadParseError } from './parseUpload';
import { clearSharedMeta } from './sharedMeta';
import { isScheduledShape, parseScheduled, saveScheduled, type Scheduled } from '../components/conditions/scheduled';
import { saveViewSettings, VIEW_SETTINGS_KEY, type ViewSettings } from '../components/conditions/ui';

export class BackupImportError extends Error {}

export type BackupContents = {
  reports?: { text: string; count: number; meta: EnvelopeMeta };
  medications?: Medications;
  scheduled?: Scheduled;
  settings?: Record<string, unknown>;
  hasLaboratoryPrices: boolean;
};

export type RestoreDeps = {
  clearReports: () => void;
  importReports: (text: string) => Promise<void> | void;
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

function readReports(files: Record<string, string>): BackupContents['reports'] {
  const text = files['lab-reports.json'];
  if (text === undefined) return undefined;
  const envelope = parsePart(files, 'lab-reports.json');
  // Exporting an empty database writes an envelope with no reports, which the
  // upload parser rejects -- here it is a valid backup of nothing.
  const empty =
    isRecord(envelope) &&
    isAcceptedSchemaVersion(envelope.schema) &&
    Array.isArray(envelope.diagnosticReports) &&
    envelope.diagnosticReports.length === 0;
  let count = 0;
  if (!empty) {
    try {
      count = parseUploadedResults(envelope).length;
    } catch (e) {
      throw new BackupImportError(`lab-reports.json: ${e instanceof UploadParseError ? e.message : 'could not be read.'}`);
    }
  }
  return { text, count, meta: sanitizeEnvelopeMeta(envelope) };
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

/** Validates every part of an unzipped backup without touching storage; throws BackupImportError on the first problem. */
export function readBackup(files: Record<string, string>): BackupContents {
  if (files['manifest.json'] === undefined) {
    throw new BackupImportError('The zip has no manifest.json, so it is not a blood tests backup.');
  }
  const manifest = parsePart(files, 'manifest.json');
  if (!isRecord(manifest) || manifest.format !== BACKUP_FORMAT || manifest.version !== BACKUP_VERSION || !Array.isArray(manifest.files)) {
    throw new BackupImportError(`manifest.json is not a ${BACKUP_FORMAT} version ${BACKUP_VERSION} manifest.`);
  }

  const contents: BackupContents = { hasLaboratoryPrices: false, reports: readReports(files), settings: readSettings(files) };

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
    // storage unavailable -- nothing stored to find
  }
  return [...keys];
}

/** Removes every user-data key: the reports' own Clear and the share-link meta first, then a sweep over the shared key list. */
export function clearAllData(clearReports: () => void): void {
  clearReports();
  clearSharedMeta();
  for (const key of storedUserDataKeys()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage unavailable -- nothing to remove
    }
  }
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function restoreReports(reports: BackupContents['reports'], importReports: RestoreDeps['importReports']): Promise<string> {
  if (!reports) return 'Lab reports: not in the backup, left empty.';
  if (reports.count > 0) await importReports(reports.text);
  if (Object.keys(reports.meta).length > 0) saveEnvelopeMeta(reports.meta);
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
  const { loincs, indices } = scheduled;
  return `Scheduled visits: ${count(loincs.length, 'observation', 'observations')} and ${count(indices.length, 'index', 'indices')} restored.`;
}

function restoreSetting(key: string, value: unknown): void {
  if (key === VIEW_SETTINGS_KEY) {
    saveViewSettings(value as ViewSettings);
    return;
  }
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // storage unavailable -- the preference just won't persist
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

/** Clears everything, then writes back each validated part through its own module; returns one line per part. */
export async function restoreBackup(backup: BackupContents, deps: RestoreDeps): Promise<string[]> {
  clearAllData(deps.clearReports);
  const reportsLine = await restoreReports(backup.reports, deps.importReports);
  return [
    reportsLine,
    restoreMedications(backup.medications),
    restoreScheduled(backup.scheduled),
    restoreSettings(backup.settings),
    laboratoryPricesLine(backup.hasLaboratoryPrices),
  ];
}
