import type { Result, Analysis } from '../types';

export const LOINC_RE = /^\d{1,7}-\d$/;

export type CrossCheckStatus = 'match' | 'mismatch' | 'unknown-code' | 'no-code' | 'malformed';

export interface CrossCheckSuggestion {
  loinc: string;
  name: string;
  score: number;
}

export interface CrossCheckResult {
  status: CrossCheckStatus;
  loincName?: string;
  suggestions?: CrossCheckSuggestion[];
}

// Keeps only whitespace-separated words whose letters are all Latin-script,
// so bilingual lab printouts like "Γλυκόζη Glucose Serum" reduce to "Glucose Serum".
export function latinPart(name: string): string {
  return name
    .split(/\s+/)
    .filter((tok) => ![...tok].some((ch) => /\p{L}/u.test(ch) && !/\p{Script=Latin}/u.test(ch)))
    .join(' ')
    .trim();
}

function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

// Fraction of `printed` tokens found among `official` tokens (0..1).
export function tokenOverlap(printed: string, official: string): number {
  const printedTokens = tokensOf(printed);
  if (printedTokens.length === 0) return 0;
  const officialTokens = new Set(tokensOf(official));
  const matched = printedTokens.filter((t) => officialTokens.has(t)).length;
  return matched / printedTokens.length;
}

function catalogEntries(catalog: Map<string, Analysis> | Analysis[]): Analysis[] {
  return Array.isArray(catalog) ? catalog : [...catalog.values()];
}

function catalogNameText(a: Analysis): string {
  return `${a.displayName} ${a.longCommonName}`;
}

// Printed names vary wildly across labs, so any meaningful token overlap
// counts as a match; only a near-zero overlap is flagged as a mismatch.
const MISMATCH_THRESHOLD = 0.2;

function suggestionsFor(item: Result, entries: Analysis[]): CrossCheckSuggestion[] {
  const name = latinPart(item.analysis);
  if (!name) return [];
  const unit = item.unit?.trim().toLowerCase();
  return entries
    .map((a) => {
      let score = tokenOverlap(name, catalogNameText(a));
      if (score > 0 && unit && catalogNameText(a).toLowerCase().includes(unit)) score += 0.1;
      return { loinc: a.loinc, name: a.displayName || a.longCommonName, score };
    })
    .filter((s) => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function crossCheckLocal(
  items: Result[],
  catalog: Map<string, Analysis> | Analysis[]
): CrossCheckResult[] {
  const entries = catalogEntries(catalog);
  const byCode = new Map(entries.map((a) => [a.loinc, a]));

  return items.map((item) => {
    const code = item.loinc?.trim() ?? '';
    if (!code) {
      return { status: 'no-code' as const, suggestions: suggestionsFor(item, entries) };
    }
    if (!LOINC_RE.test(code)) {
      return { status: 'malformed' as const };
    }
    const entry = byCode.get(code);
    if (!entry) {
      return { status: 'unknown-code' as const };
    }
    const loincName = entry.displayName || entry.longCommonName;
    const printed = latinPart(item.analysis);
    const overlap = Math.max(
      tokenOverlap(printed, catalogNameText(entry)),
      tokenOverlap(catalogNameText(entry), printed)
    );
    return {
      status: overlap < MISMATCH_THRESHOLD ? ('mismatch' as const) : ('match' as const),
      loincName,
    };
  });
}

// --- Stage 2: NLM Clinical Tables lookup ---

const NLM_BASE = 'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search';

export interface NlmEntry {
  loinc: string;
  name: string;
}

export interface NlmLookupResult {
  status: 'ok' | 'failed';
  byCode: Record<string, string | null>;
  byName: Record<string, NlmEntry[]>;
}

// Response shape: [count, LOINC_NUM[], null, [LOINC_NUM, LONG_COMMON_NAME][]]
async function nlmSearch(terms: string, fetchFn: typeof fetch): Promise<NlmEntry[]> {
  const url = `${NLM_BASE}?terms=${encodeURIComponent(terms)}&df=LOINC_NUM,LONG_COMMON_NAME&maxList=10`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`NLM lookup failed: ${res.status}`);
  const data = (await res.json()) as [number, string[], null, string[][]];
  const rows = Array.isArray(data?.[3]) ? data[3] : [];
  return rows
    .filter((row) => Array.isArray(row) && row.length >= 2)
    .map((row) => ({ loinc: row[0]!, name: row[1]! }));
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
      byName[name] = (await nlmSearch(name, fetchFn)).slice(0, 3);
    } catch {
      failed = true;
    }
  }

  return { status: failed ? 'failed' : 'ok', byCode, byName };
}
