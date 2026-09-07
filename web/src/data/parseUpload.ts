import type { Result, DiagnosticReport } from '../types';
import { isAcceptedSchemaVersion } from './envelopeSchema';
import type {
  InterchangeEnvelope,
  InterchangeObservation,
  InterchangeReport,
} from './envelopeTypes';

/**
 * Parses a visitor-uploaded JSON file into DiagnosticReport[].
 *
 * One shape is accepted: the v3 interchange envelope,
 * `{ schema: 3, diagnosticReports: [...] }` — what this project's export
 * pipeline and the chatbot prompt both produce. Each DiagnosticReport maps
 * to a DiagnosticReport, with observations transformed into results.
 *
 * Older files (envelopes stamped `schema: 1`, project-bloodtests-v2's
 * canonical draws, and the flat/grouped legacy shapes) are no longer read
 * here: they are converted offline with `npm run convert:v3` first. See
 * `docs/tech/decisions/adr-0009-v3-only-and-rawname.md`.
 */

function slugify(text: string): string {
  const value = (text || 'unknown').trim().toLowerCase().replaceAll('/', ' ');
  // Split on non-alphanumeric runs and rejoin: same slug, no trailing-anchor
  // regex (which Sonar flags for super-linear backtracking).
  const slug = value.split(/[^a-z0-9]+/).filter(Boolean).join('-');
  return slug || 'unknown';
}

/**
 * Extract YYYY-MM-DD from ISO timestamp.
 * Assumes input is ISO 8601 (e.g., "2024-06-15T00:00:00Z").
 */
function extractDateFromISO(isoString: string): string {
  if (!isoString || typeof isoString !== 'string') return '';
  const match = isoString.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function v3ToResult(obs: InterchangeObservation): Result {
  const refMin = obs.referenceRanges?.find((r) => r.high != null || r.low != null);
  return {
    loinc: obs.loinc || '',
    analysis: obs.rawName || '',
    symbol: '',
    section: '',
    value: obs.value != null ? obs.value : null,
    rawValue: obs.rawValue || '',
    valueQualifier: obs.comparator || '',
    unit: obs.unit || '',
    refText:
      obs.referenceRanges?.find((r) => r.text)?.text ||
      obs.referenceRanges?.map((r) => r.label || `${r.low ?? ''}-${r.high ?? ''}`).join('; ') ||
      '',
    refMin: refMin?.low ?? null,
    refMax: refMin?.high ?? null,
    method: obs.method || '',
  };
}

function v3ToGroup(report: InterchangeReport, index: number): DiagnosticReport {
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
  const place = report.lab || 'Unknown Lab';
  // The report's own identifier (visit/order/accession) disambiguates two
  // draws from the same lab on the same date — without it they'd collide on
  // the same session id and silently replace each other on merge.
  const ident = report.identifiers?.visit || report.identifiers?.order || report.identifiers?.accession;

  return {
    date,
    place,
    file: `${date}__${slugify(place)}${ident ? `__${slugify(String(ident))}` : ''}`,
    items,
    itemCount: items.length,
  };
}

function isV3Envelope(x: unknown): x is InterchangeEnvelope {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return isAcceptedSchemaVersion(o.schema) && Array.isArray(o.diagnosticReports);
}

export class UploadParseError extends Error {}

export function parseUploadedResults(data: unknown): DiagnosticReport[] {
  if (!isV3Envelope(data)) {
    throw new UploadParseError(
      'Unrecognized JSON shape. Expected a v3 interchange envelope shaped like { "schema": 3, "diagnosticReports": [...] }. An older file has to be converted first.'
    );
  }

  try {
    if (data.diagnosticReports.length === 0) {
      throw new UploadParseError('diagnosticReports must be a non-empty array.');
    }
    const groups = data.diagnosticReports.map((report, i) => v3ToGroup(report, i));
    return groups.sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    if (e instanceof UploadParseError) throw e;
    throw new UploadParseError(`Failed to parse v3 envelope: ${e instanceof Error ? e.message : String(e)}`);
  }
}
