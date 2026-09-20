import type { DiagnosticReport, Result } from '../types';
import { contentHashOf } from './contentHash';
import { SCHEMA_VERSION } from './envelopeSchema';
import type { InterchangeObservation, InterchangeReport } from './envelopeTypes';
import { slugify } from './parseUpload';

// Stored files are the truth (ADR-0028): a file is never rebuilt from the parsed model. The only places
// this module writes JSON are the three where the app itself creates or changes a file.

export const REPORTS_PREFIX = 'reports/';

export function isReportPath(path: string): boolean {
  return path.startsWith(REPORTS_PREFIX) && path.endsWith('.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fileText(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function reportDate(collectedAt: unknown): string {
  const date = typeof collectedAt === 'string' ? collectedAt.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'unknown';
}

/** `reports/YYYY-MM-DD__<lab>.json`, `-2`, `-3`… when the name is taken. Adds the chosen path to `taken`. */
export function reportPathFor(collectedAt: unknown, lab: unknown, taken: Set<string>): string {
  const base = `${REPORTS_PREFIX}${reportDate(collectedAt)}__${slugify(typeof lab === 'string' ? lab : '')}`;
  let n = 1;
  let path = `${base}.json`;
  while (taken.has(path)) path = `${base}-${++n}.json`;
  taken.add(path);
  return path;
}

/**
 * A new upload becomes one file per report, spreading the original objects. A single-report
 * upload that already carries `lastUpdatedDate` keeps its own text. Nothing is normalized.
 */
export function filesFromUpload(
  envelope: Record<string, unknown>,
  text: string | undefined,
  taken: Set<string>,
  now: Date
): Record<string, string> {
  const reports = envelope.diagnosticReports as InterchangeReport[];
  const own = typeof envelope.lastUpdatedDate === 'string' ? envelope.lastUpdatedDate : undefined;
  const files: Record<string, string> = {};
  for (const report of reports) {
    const path = reportPathFor(report?.collectedAt, report?.lab, taken);
    if (reports.length === 1 && own !== undefined && text !== undefined) {
      files[path] = text;
      continue;
    }
    const single: Record<string, unknown> = {
      ...envelope,
      diagnosticReports: [report],
      lastUpdatedDate: own ?? now.toISOString(),
    };
    if (reports.length > 1 && typeof envelope.contentHash === 'string') single.contentHash = contentHashOf([report]);
    files[path] = fileText(single);
  }
  return files;
}

// Only for a session with no stored file (generated test data, or sessions kept by a build before
// held files existed): nothing was ever printed for the unit beyond `rawUnit`, and none is derived.
function observationOf(result: Result): InterchangeObservation {
  return {
    loinc: result.loinc,
    rawName: result.rawName,
    ...(result.value !== null && { value: result.value }),
    ...(result.rawValue && { rawValue: result.rawValue }),
    ...(result.valueQualifier && { comparator: result.valueQualifier as InterchangeObservation['comparator'] }),
    ...(result.unit && { rawUnit: result.unit }),
    ...((result.refMin !== null || result.refMax !== null) && {
      referenceRanges: [
        {
          ...(result.refMin !== null && { low: result.refMin }),
          ...(result.refMax !== null && { high: result.refMax }),
          ...(result.refText && { text: result.refText }),
        },
      ],
    }),
    ...(result.method && { method: result.method }),
  };
}

function fileFromSession(session: DiagnosticReport, now: Date): { collectedAt: string; lab: string; text: string } {
  const report: InterchangeReport = {
    lab: session.place,
    collectedAt: `${session.date}T00:00:00Z`,
    observations: (session.items ?? []).map(observationOf),
  };
  const text = fileText({
    schema: SCHEMA_VERSION,
    lastUpdatedDate: now.toISOString(),
    contentHash: contentHashOf([report]),
    diagnosticReports: [report],
  });
  return { collectedAt: report.collectedAt, lab: report.lab ?? '', text };
}

/**
 * The stored file behind every session. A session whose file is held keeps that text untouched;
 * one without gets a file built once and pointed at. Files no session points at are dropped.
 */
export function resolveReportFiles(
  sessions: DiagnosticReport[],
  held: Record<string, string>,
  now: Date
): { sessions: DiagnosticReport[]; files: Record<string, string> } {
  const files: Record<string, string> = {};
  for (const { source } of sessions) if (source && held[source.path] !== undefined) files[source.path] = held[source.path];
  const taken = new Set(Object.keys(files));
  const resolved = sessions.map((session) => {
    if (session.source && files[session.source.path] !== undefined) return session;
    const built = fileFromSession(session, now);
    const path = reportPathFor(built.collectedAt, built.lab, taken);
    files[path] = built.text;
    return { ...session, source: { path, index: 0 } };
  });
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { sessions: resolved, files: sorted };
}

function setValue(obs: Record<string, unknown>, after: Result): void {
  if (after.value === null) delete obs.value;
  else obs.value = after.value;
  if (after.rawValue === '') delete obs.rawValue;
  else obs.rawValue = after.rawValue;
}

/**
 * An edit patches the touched observation fields in the stored file (never `unit` derived from
 * `rawUnit`; an edited stored unit writes `unit` and leaves `rawUnit` alone), refreshes `lastUpdatedDate`, and keeps `contentHash` current only if the file has one.
 */
export function patchEditedFile(text: string, index: number, before: Result[], after: Result[], now: Date): string {
  const envelope = JSON.parse(text) as Record<string, unknown>;
  const report = (envelope.diagnosticReports as unknown[])[index];
  const observations = isRecord(report) && Array.isArray(report.observations) ? (report.observations as Record<string, unknown>[]) : [];
  after.forEach((next, i) => {
    const prev = before[i];
    const obs = observations[i];
    if (!prev || !obs) return;
    if (next.loinc !== prev.loinc) obs.loinc = next.loinc;
    if (next.value !== prev.value || next.rawValue !== prev.rawValue) setValue(obs, next);
    if (next.unit !== prev.unit) obs['unit' in obs && !('rawUnit' in obs) ? 'unit' : 'rawUnit'] = next.unit;
    if (next.storedUnit !== prev.storedUnit && next.storedUnit !== undefined) {
      if (next.storedUnit === '') delete obs.unit;
      else obs.unit = next.storedUnit;
    }
  });
  envelope.lastUpdatedDate = now.toISOString();
  if ('contentHash' in envelope) envelope.contentHash = contentHashOf(envelope.diagnosticReports as unknown[]);
  return fileText(envelope);
}
