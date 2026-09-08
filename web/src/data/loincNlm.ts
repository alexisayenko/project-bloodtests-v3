// The app's only network call, and its single privacy exception: an explicit
// opt-in sends test names — never values — to the NLM Clinical Tables API.
import { ALLOWED_UNITS } from './analyteCatalog';
import { canonicalUnit, normalizeUnit } from './loincCheck';

const NLM_BASE = 'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search';

export interface NlmEntry {
  loinc: string;
  name: string;
  unit?: string;
}

export interface NlmLookupResult {
  status: 'ok' | 'failed';
  byCode: Record<string, string | null>;
  byName: Record<string, NlmEntry[]>;
}

// EXAMPLE_UCUM_UNITS can list several units ("mg/dL;mmol/L"); our own
// ALLOWED_UNITS extras for the entry's code count as agreement too.
function nlmUnitMatches(entry: NlmEntry, rowUnit: string): boolean {
  return [...(entry.unit ?? '').split(/[;,]/), ...(ALLOWED_UNITS[entry.loinc] ?? [])].some(
    (u) => canonicalUnit(u) === rowUnit
  );
}

// The same unit selection as the local ladder, for NLM name-search results:
// entries agreeing with the row's unit win; ones contradicting it are dropped
// once any agreeing entry exists (unknown-unit entries are kept as fallback).
export function selectByUnit(entries: NlmEntry[], rowUnit: string | undefined): NlmEntry[] {
  const unit = canonicalUnit(rowUnit);
  if (!unit) return entries;
  const matching = entries.filter((e) => nlmUnitMatches(e, unit));
  if (matching.length === 0) return entries;
  return [...matching, ...entries.filter((e) => !normalizeUnit(e.unit))];
}

// Response shape: [count, LOINC_NUM[], null, [LOINC_NUM, LONG_COMMON_NAME, EXAMPLE_UCUM_UNITS][]]
async function nlmSearch(terms: string, fetchFn: typeof fetch): Promise<NlmEntry[]> {
  const url = `${NLM_BASE}?terms=${encodeURIComponent(terms)}&df=LOINC_NUM,LONG_COMMON_NAME,EXAMPLE_UCUM_UNITS&maxList=10`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`NLM lookup failed: ${res.status}`);
  const data = (await res.json()) as [number, string[], null, string[][]];
  const rows = Array.isArray(data?.[3]) ? data[3] : [];
  return rows
    .filter((row) => Array.isArray(row) && row.length >= 2)
    .map((row) => ({ loinc: row[0]!, name: row[1]!, unit: row[2] || undefined }));
}

export async function fetchNlmLoinc(
  codes: string[],
  names: string[],
  fetchFn: typeof fetch = fetch
): Promise<NlmLookupResult> {
  const byCode: Record<string, string | null> = {};
  const byName: Record<string, NlmEntry[]> = {};
  let failed = false;

  for (const code of codes) {
    try {
      const entries = await nlmSearch(code, fetchFn);
      byCode[code] = entries.find((e) => e.loinc === code)?.name ?? null;
    } catch {
      failed = true;
    }
  }

  for (const name of names) {
    try {
      byName[name] = await nlmSearch(name, fetchFn);
    } catch {
      failed = true;
    }
  }

  return { status: failed ? 'failed' : 'ok', byCode, byName };
}
