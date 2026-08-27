import type { Result, DiagnosticReport } from '../types';
import { safeParseDraws, type Draw, type LabItem } from './drawsSchema';

/**
 * Parses a visitor-uploaded JSON file into DiagnosticReport[].
 *
 * Matches shapes produced by this project's own export pipeline, by
 * project-bloodtests-v2's engine, and by the chatbot (v3 envelope schema).
 * Four shapes are accepted, tried in this order:
 *
 * 1. V3 envelope — chatbot-generated schema: `{ schema: 1, diagnosticReports: [...] }`.
 *    Each DiagnosticReport maps to a DiagnosticReport, with observations transformed
 *    into results. Detected first and fails loudly if malformed (doesn't fall through).
 *
 * 2. Canonical draws — the current shape produced by v2's engine (see
 *    `drawsSchema.ts`, ported from its `schema.ts`): a JSON array of
 *    `{ date, labName, sourceFile?, items }`, where each item's value
 *    lives under `item.original` (with `us`/`si` siblings, unused here).
 *    Detected and validated via `safeParseDraws`; a shape that looks like
 *    an attempt at this (has `labName` and/or `items` with `original`/
 *    `shortName`) but fails validation raises immediately rather than
 *    falling through to the legacy shapes below.
 *
 * 3. Flat entries (legacy) — a JSON array of individual lab-result rows,
 *    each with at least a `date` field (this is what
 *    `imports/<file>.json` contained in the original private project).
 *    Rows are grouped client-side into sessions by (date, place), the
 *    same way the old Python import script grouped them into
 *    `results-by-date/*.json`.
 *
 * 4. Grouped sessions (legacy) — a JSON array (or single object) already
 *    shaped like `results-by-date/*.json`: `{ date, place, items }`,
 *    with each item's fields flat (`value`/`unit`/`refMin`/... directly
 *    on the item, not nested under `original`). Used as-is, no
 *    re-grouping.
 */

type RawScalar = string | number | null;

interface RawEntry {
  date?: string | null;
  place?: string | null;
  sourceFile?: string | null;
  section?: string | null;
  symbol?: string | null;
  analysis?: string | null;
  loinc?: string | null;
  rawValue?: RawScalar;
  value?: RawScalar;
  valueQualifier?: string | null;
  unit?: string | null;
  refText?: string | null;
  refMin?: number | string | null;
  refMax?: number | string | null;
  method?: string | null;
}

interface RawGroup {
  date?: string | null;
  place?: string | null;
  file?: string | null;
  sourceFile?: string | null;
  items?: RawEntry[] | null;
}

// V3 envelope schema types (chatbot-generated)
interface V3ReferenceRange {
  low?: number;
  high?: number;
  label?: string;
  text?: string;
  appliesTo?: { sex?: 'male' | 'female' };
  ageLow?: number;
  ageHigh?: number;
}

interface V3Observation {
  loinc?: string;
  name: string;
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  rawValue?: string;
  unit?: string;
  referenceRanges?: V3ReferenceRange[];
  interpretation?:
    | 'N'
    | 'A'
    | 'H'
    | 'L'
    | 'HH'
    | 'LL'
    | 'POS'
    | 'NEG';
  method?: string;
}

interface V3Identifier {
  visit?: string;
  order?: string;
  accession?: string;
}

interface V3DiagnosticReport {
  lab: string;
  collectedAt: string;
  identifiers?: V3Identifier;
  observations: V3Observation[];
}

interface V3Envelope {
  schema: number;
  sex?: 'male' | 'female';
  birthYear?: number;
  diagnosticReports: V3DiagnosticReport[];
}

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

/**
 * Convert v3 Observation to v2 Result shape.
 */
function v3ToResult(obs: V3Observation): Result {
  const refMin = obs.referenceRanges?.find((r) => r.high != null || r.low != null);
  return {
    loinc: obs.loinc || '',
    analysis: obs.name || '',
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

/**
 * Convert v3 DiagnosticReport to v2 DiagnosticReport shape.
 */
function v3ToGroup(report: V3DiagnosticReport, index: number): DiagnosticReport {
  if (!report.diagnosticReports && !Array.isArray(report.observations)) {
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

  return {
    date,
    place,
    file: `${date}__${slugify(place)}`,
    items,
    itemCount: items.length,
  };
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toResult(raw: RawEntry): Result {
  return {
    loinc: raw.loinc || '',
    analysis: raw.analysis || '',
    symbol: raw.symbol || '',
    section: raw.section || '',
    value: toNumber(raw.value),
    rawValue: raw.rawValue != null ? String(raw.rawValue) : '',
    valueQualifier: raw.valueQualifier || '',
    unit: raw.unit || '',
    refText: raw.refText || '',
    refMin: toNumber(raw.refMin),
    refMax: toNumber(raw.refMax),
    method: raw.method || '',
  };
}

function isV3Envelope(x: unknown): x is V3Envelope {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.schema === 1 &&
    Array.isArray(o.diagnosticReports)
  );
}

function isGroupShape(x: unknown): x is RawGroup {
  return !!x && typeof x === 'object' && Array.isArray((x as RawGroup).items);
}

function isEntryShape(x: unknown): x is RawEntry {
  return !!x && typeof x === 'object' && 'date' in x;
}

/**
 * True when `x` looks like an attempt at the canonical draws shape
 * (`{ date, labName, items }` with items shaped like `{ original: {...} }`
 * / `{ shortName }`), as opposed to the legacy grouped-sessions shape
 * (`{ date, place, items }` with flat item fields). Used to route to the
 * canonical parser and to fail loudly on malformed canonical data instead
 * of silently misparsing it as a legacy shape.
 */
function looksLikeCanonicalDraw(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.labName === 'string') return true;
  if (Array.isArray(o.items)) {
    return o.items.some((it) => {
      if (!it || typeof it !== 'object') return false;
      const io = it as Record<string, unknown>;
      return 'original' in io || 'shortName' in io;
    });
  }
  return false;
}

function labItemToResult(item: LabItem): Result {
  return {
    loinc: item.loinc || '',
    analysis: item.analysis || '',
    symbol: item.shortName || '',
    section: '',
    value: item.original.value,
    rawValue: item.original.rawValue != null ? String(item.original.rawValue) : '',
    valueQualifier: '',
    unit: item.original.unit || '',
    refText: item.original.refText || '',
    refMin: item.original.refMin ?? null,
    refMax: item.original.refMax ?? null,
    method: item.method || '',
  };
}

function drawsToGroups(draws: Draw[]): DiagnosticReport[] {
  const groups = draws.map((d, i): DiagnosticReport => {
    const items = d.items.map(labItemToResult);
    return {
      date: d.date,
      place: d.labName,
      file: d.sourceFile || `${d.date || 'unknown'}__${slugify(d.labName)}` || `session-${i}`,
      items,
      itemCount: items.length,
    };
  });
  return groups.sort((a, b) => b.date.localeCompare(a.date));
}

export class UploadParseError extends Error {}

export function parseUploadedResults(data: unknown): DiagnosticReport[] {
  // Check for v3 envelope first (before any array processing)
  if (data && typeof data === 'object' && isV3Envelope(data)) {
    try {
      const envelope = data as V3Envelope;
      if (!Array.isArray(envelope.diagnosticReports) || envelope.diagnosticReports.length === 0) {
        throw new UploadParseError('diagnosticReports must be a non-empty array.');
      }
      const groups = envelope.diagnosticReports.map((report, i) => v3ToGroup(report, i));
      return groups.sort((a, b) => b.date.localeCompare(a.date));
    } catch (e) {
      if (e instanceof UploadParseError) throw e;
      throw new UploadParseError(`Failed to parse v3 envelope: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) {
    throw new UploadParseError('The file is empty.');
  }

  if (arr.some(looksLikeCanonicalDraw)) {
    const parsed = safeParseDraws(arr);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.length ? ` at ${issue.path.join('.')}` : '';
      throw new UploadParseError(
        `Invalid lab-results data${path}: ${issue?.message ?? parsed.error.message}`
      );
    }
    return drawsToGroups(parsed.data);
  }

  if (arr.every(isGroupShape)) {
    const groups = (arr as RawGroup[]).map((g, i): DiagnosticReport => {
      const date = g.date || '';
      const place = g.place || '';
      const items = (g.items || []).map(toResult);
      return {
        date,
        place,
        file: g.file || `${date || 'unknown'}__${slugify(place)}` || `session-${i}`,
        items,
        itemCount: items.length,
      };
    });
    return groups.sort((a, b) => b.date.localeCompare(a.date));
  }

  if (!arr.every(isEntryShape)) {
    throw new UploadParseError(
      'Unrecognized JSON shape. Expected either a list of result entries with a "date" field, or a list of sessions shaped like { date, place, items }.'
    );
  }

  const byKey = new Map<string, { date: string; place: string; items: Result[] }>();
  for (const raw of arr as RawEntry[]) {
    const date = raw.date || '';
    if (!date) continue;
    const place = raw.place || 'Unknown Lab';
    const key = `${date}__${place}`;
    if (!byKey.has(key)) byKey.set(key, { date, place, items: [] });
    byKey.get(key)!.items.push(toResult(raw));
  }

  if (byKey.size === 0) {
    throw new UploadParseError('No dated result entries were found in that file.');
  }

  const groups: DiagnosticReport[] = Array.from(byKey.values()).map(g => ({
    date: g.date,
    place: g.place,
    file: `${g.date}__${slugify(g.place)}`,
    items: g.items,
    itemCount: g.items.length,
  }));

  return groups.sort((a, b) => b.date.localeCompare(a.date));
}
