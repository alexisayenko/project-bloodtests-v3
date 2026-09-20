import type { Result, DiagnosticReport } from '../types';
import { isAcceptedSchemaVersion } from './envelopeSchema';
import { normalizeObservationUnit } from './unitNormalization';
import type {
  InterchangeEnvelope,
  InterchangeObservation,
  InterchangeReport,
} from './envelopeTypes';

/** The interchange format's own spelling of "the report names no lab". */
export const UNKNOWN_LAB = 'Unknown Lab';

// Only the v3 envelope is read (any `3.x`, or the legacy bare `3`, ADR-0012);
// older shapes go through `npm run convert:v3` first (ADR-0009). Every import
// route passes through here, so this is the one place unit normalization runs.

export function slugify(text: string): string {
  const value = (text || 'unknown').trim().toLowerCase().replaceAll('/', ' ');
  // Split on non-alphanumeric runs and rejoin: same slug, no trailing-anchor
  // regex (which Sonar flags for super-linear backtracking).
  const slug = value.split(/[^a-z0-9]+/).filter(Boolean).join('-');
  return slug || 'unknown';
}

function extractDateFromISO(isoString: string): string {
  if (!isoString || typeof isoString !== 'string') return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(isoString);
  return match ? match[1] : '';
}

// The printed pair stays untouched; a unit that can't be placed attaches
// nothing and is left for `validateDiagnosticReports` to warn about.
function withCanonicalUnit(result: Result): Result {
  if (!result.loinc || !result.unit) return result;
  const { canonical } = normalizeObservationUnit({
    loinc: result.loinc,
    unit: result.unit,
    ...(result.value !== null && { value: result.value }),
  });
  return canonical ? { ...result, canonical } : result;
}

function v3ToResult(obs: InterchangeObservation): Result {
  const refMin = obs.referenceRanges?.find((r) => r.high != null || r.low != null);
  return withCanonicalUnit({
    loinc: obs.loinc || '',
    rawName: obs.rawName || '',
    section: '',
    value: obs.value ?? null,
    rawValue: obs.rawValue || '',
    valueQualifier: obs.comparator || '',
    // `rawUnit` wins: in a file this app exported, `unit` is already a UCUM
    // code, and the printed string is what the app displays and validates.
    unit: obs.rawUnit || obs.unit || '',
    refText:
      obs.referenceRanges?.find((r) => r.text)?.text ||
      obs.referenceRanges?.map((r) => r.label || `${r.low ?? ''}-${r.high ?? ''}`).join('; ') ||
      '',
    refMin: refMin?.low ?? null,
    refMax: refMin?.high ?? null,
    method: obs.method || '',
  });
}

function v3ToGroup(report: InterchangeReport, index: number, sourcePath?: string): DiagnosticReport {
  if (!Array.isArray(report.observations)) {
    throw new UploadParseError(`DiagnosticReport at index ${index} is missing observations array`);
  }

  const date = extractDateFromISO(report.collectedAt);
  if (!date) {
    throw new UploadParseError(
      `DiagnosticReport at index ${index} has an invalid collectedAt timestamp: ${report.collectedAt}`
    );
  }

  const items = report.observations.map(v3ToResult);
  const place = report.lab || UNKNOWN_LAB;
  // Without the identifier, two same-day draws from one lab would share a
  // session id and silently replace each other on merge.
  const ident = report.identifiers?.visit || report.identifiers?.order || report.identifiers?.accession;
  const identSuffix = ident ? `__${slugify(String(ident))}` : '';

  return {
    date,
    place,
    file: `${date}__${slugify(place)}${identSuffix}`,
    items,
    itemCount: items.length,
    ...(sourcePath !== undefined && { source: { path: sourcePath, index } }),
  };
}

function isV3Envelope(x: unknown): x is InterchangeEnvelope {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return isAcceptedSchemaVersion(o.schema) && Array.isArray(o.diagnosticReports);
}

export class UploadParseError extends Error {}

/** With `sourcePath`, each session records which stored file (and position in it) it was read from. */
export function parseUploadedResults(data: unknown, sourcePath?: string): DiagnosticReport[] {
  if (!isV3Envelope(data)) {
    throw new UploadParseError(
      'Unrecognized JSON shape. Expected a v3 interchange envelope shaped like { "schema": "3.2", "diagnosticReports": [...] } — any "3.x" version is read, as is the legacy number 3. An older file has to be converted first.'
    );
  }

  try {
    if (data.diagnosticReports.length === 0) {
      throw new UploadParseError('diagnosticReports must be a non-empty array.');
    }
    const groups = data.diagnosticReports.map((report, i) => v3ToGroup(report, i, sourcePath));
    return groups.sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    if (e instanceof UploadParseError) throw e;
    throw new UploadParseError(`Failed to parse v3 envelope: ${e instanceof Error ? e.message : String(e)}`);
  }
}
