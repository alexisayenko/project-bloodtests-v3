import type { Result, ResultGroup } from '../types';

/**
 * Parses a visitor-uploaded JSON file into ResultGroup[].
 *
 * Matches the shape produced by this project's own export pipeline
 * (see import_lab_results.py in the original private project), so an
 * existing export can be uploaded as-is. Two shapes are accepted:
 *
 * 1. Flat entries — a JSON array of individual lab-result rows, each
 *    with at least a `date` field (this is what
 *    `imports/<file>.json` contains). Rows are grouped client-side
 *    into sessions by (date, place), the same way the Python script
 *    groups them into `results-by-date/*.json`.
 *
 * 2. Grouped sessions — a JSON array (or single object) already
 *    shaped like `results-by-date/*.json`: `{ date, place, items }`.
 *    Used as-is, no re-grouping.
 */

interface RawEntry {
  date?: string | null;
  place?: string | null;
  sourceFile?: string | null;
  section?: string | null;
  symbol?: string | null;
  analysis?: string | null;
  loinc?: string | null;
  rawValue?: string | number | null;
  value?: number | string | null;
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

function slugify(text: string): string {
  const value = (text || 'unknown').trim().toLowerCase().replace(/\//g, ' ');
  const slug = value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'unknown';
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

function isGroupShape(x: unknown): x is RawGroup {
  return !!x && typeof x === 'object' && Array.isArray((x as RawGroup).items);
}

function isEntryShape(x: unknown): x is RawEntry {
  return !!x && typeof x === 'object' && 'date' in x;
}

export class UploadParseError extends Error {}

export function parseUploadedResults(data: unknown): ResultGroup[] {
  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) {
    throw new UploadParseError('The file is empty.');
  }

  if (arr.every(isGroupShape)) {
    const groups = (arr as RawGroup[]).map((g, i): ResultGroup => {
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

  const groups: ResultGroup[] = Array.from(byKey.values()).map(g => ({
    date: g.date,
    place: g.place,
    file: `${g.date}__${slugify(g.place)}`,
    items: g.items,
    itemCount: g.items.length,
  }));

  return groups.sort((a, b) => b.date.localeCompare(a.date));
}
