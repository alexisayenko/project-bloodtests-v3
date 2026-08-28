import type { Result, Analysis } from '../types';
import { SHORT_LABELS, ALSO_REFS } from '../components/conditions/markers';

export const LOINC_RE = /^\d{1,7}-\d$/;

export type CrossCheckStatus = 'match' | 'mismatch' | 'unknown-code' | 'no-code' | 'malformed';

export interface CrossCheckSuggestion {
  loinc: string;
  name: string;
  score: number;
  unit?: string;
}

export interface CrossCheckResult {
  status: CrossCheckStatus;
  loincName?: string;
  suggestions?: CrossCheckSuggestion[];
  // True when the name+unit derivation clearly dominates — safe to auto-apply.
  confident?: boolean;
  // The code the ladder derived, when it confidently disagrees with the printed one.
  derived?: { loinc: string; name: string };
}

// "mIU/L" ≈ "miu/l", "μIU/mL" ≈ "uiu/ml", "x10^3/μL" ≈ "x10^3/ul", "mg/dL." ≈ "mg/dl".
export function normalizeUnit(unit: string | undefined | null): string {
  return (unit ?? '')
    .toLowerCase()
    .replace(/[μµ]/g, 'u')
    .replace(/\s+/g, '')
    .replace(/\.+$/, '');
}

// Known reference unit per LOINC, from the curated marker tables — this is what
// lets the row's unit pick the right variant of a multi-code analyte.
const DEFAULT_UNITS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SHORT_LABELS).map(([loinc, v]) => [loinc, v.unit])),
  ...Object.fromEntries(
    Object.values(ALSO_REFS)
      .flat()
      .map((ref) => [ref.loinc, ref.unit])
  ),
};

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

// Any-script tokenizer for the translation pass — Greek/Cyrillic printed names
// must not be stripped there.
function unicodeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
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

// Rarity (IDF) weight per token across the catalog: "index"/"total"/"serum"
// appear everywhere and should barely count; "HDL" or "prothrombin" pin the
// analyte. Weight = 1/log2(2+df).
function tokenWeights(entries: Analysis[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const a of entries) {
    for (const t of new Set(tokensOf(catalogNameText(a)))) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const weights = new Map<string, number>();
  for (const [t, n] of df) weights.set(t, 1 / Math.log2(2 + n));
  return weights;
}

// A candidate whose known unit agrees with the row's is boosted; one whose
// known unit contradicts it is heavily penalized — the unit hard-selects among
// same-named variants (e.g. Prolactin mIU/L vs ng/mL).
function unitAdjust(base: number, rowUnit: string, candUnit: string): number {
  if (base <= 0 || !rowUnit || !candUnit) return base;
  // Multiplicative, so the unit signal scales with name similarity instead of
  // lifting a weak name hit past a strong one.
  return candUnit === rowUnit ? base * 1.3 : base * 0.3;
}

function rankCandidates(scored: CrossCheckSuggestion[]): CrossCheckSuggestion[] {
  return scored
    .filter((s) => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    // When the best candidate clearly dominates, weaker share-a-token hits
    // (e.g. "Total Cholesterol" for an "HDL Cholesterol" row) are noise.
    .filter((s, _i, ranked) => s.score >= ranked[0]!.score * 0.75);
}

// Ladder stage a: Latin part of the printed name vs catalog English names.
function stageLatin(
  item: Result,
  entries: Analysis[],
  weights: Map<string, number>,
  unitByLoinc: Record<string, string>
): CrossCheckSuggestion[] {
  const name = latinPart(item.analysis);
  if (!name) return [];
  const rowUnit = normalizeUnit(item.unit);
  const queryTokens = tokensOf(name);
  const weightOf = (t: string) => weights.get(t) ?? 1;
  const totalWeight = queryTokens.reduce((s, t) => s + weightOf(t), 0);
  if (totalWeight === 0) return [];
  return rankCandidates(
    entries.map((a) => {
      const officialTokens = new Set(tokensOf(catalogNameText(a)));
      const base =
        queryTokens.filter((t) => officialTokens.has(t)).reduce((s, t) => s + weightOf(t), 0) / totalWeight;
      return {
        loinc: a.loinc,
        name: a.displayName || a.longCommonName,
        score: unitAdjust(base, rowUnit, normalizeUnit(unitByLoinc[a.loinc])),
        unit: unitByLoinc[a.loinc],
      };
    })
  );
}

// Ladder stage b: the full printed name vs catalog `lang` translations.
function stageLang(item: Result, entries: Analysis[], unitByLoinc: Record<string, string>): CrossCheckSuggestion[] {
  const queryTokens = unicodeTokens(item.analysis);
  if (queryTokens.length === 0) return [];
  const rowUnit = normalizeUnit(item.unit);
  return rankCandidates(
    entries.map((a) => {
      const langTokens = new Set(unicodeTokens(Object.values(a.lang ?? {}).join(' ')));
      const base =
        langTokens.size === 0 ? 0 : queryTokens.filter((t) => langTokens.has(t)).length / queryTokens.length;
      return {
        loinc: a.loinc,
        name: a.displayName || a.longCommonName,
        score: unitAdjust(base, rowUnit, normalizeUnit(unitByLoinc[a.loinc])),
        unit: unitByLoinc[a.loinc],
      };
    })
  );
}

export interface ResolveResult {
  candidates: CrossCheckSuggestion[];
  confident: boolean;
}

function isConfident(
  candidates: CrossCheckSuggestion[],
  item: Result,
  unitByLoinc: Record<string, string>
): boolean {
  const [top, second] = candidates;
  if (!top || top.score < 0.7) return false;
  if (second && top.score < second.score + 0.25) return false;
  const rowUnit = normalizeUnit(item.unit);
  const candUnit = normalizeUnit(unitByLoinc[top.loinc]);
  return !rowUnit || !candUnit || rowUnit === candUnit;
}

function resolveWith(
  item: Result,
  entries: Analysis[],
  weights: Map<string, number>,
  unitByLoinc: Record<string, string>
): ResolveResult {
  let candidates = stageLatin(item, entries, weights, unitByLoinc);
  if (candidates.length === 0) candidates = stageLang(item, entries, unitByLoinc);
  return { candidates, confident: isConfident(candidates, item, unitByLoinc) };
}

// Derive a LOINC from the printed name + unit alone — the printed code plays
// no part here, so the result can corroborate or contradict it.
export function resolveLoinc(
  item: Result,
  catalog: Map<string, Analysis> | Analysis[],
  unitByLoinc: Record<string, string> = DEFAULT_UNITS
): ResolveResult {
  const entries = catalogEntries(catalog);
  return resolveWith(item, entries, tokenWeights(entries), unitByLoinc);
}

export function crossCheckLocal(
  items: Result[],
  catalog: Map<string, Analysis> | Analysis[],
  unitByLoinc: Record<string, string> = DEFAULT_UNITS
): CrossCheckResult[] {
  const entries = catalogEntries(catalog);
  const byCode = new Map(entries.map((a) => [a.loinc, a]));
  const weights = tokenWeights(entries);

  return items.map((item) => {
    const code = item.loinc?.trim() ?? '';
    const { candidates, confident } = resolveWith(item, entries, weights, unitByLoinc);
    if (!code) {
      return { status: 'no-code' as const, suggestions: candidates, confident };
    }
    if (!LOINC_RE.test(code)) {
      return { status: 'malformed' as const, suggestions: candidates, confident };
    }
    const entry = byCode.get(code);
    const loincName = entry ? entry.displayName || entry.longCommonName : undefined;
    const top = candidates[0];
    // The derivation is the authority: a printed code is only evidence.
    if (confident && top) {
      if (top.loinc === code) {
        return { status: 'match' as const, loincName: loincName ?? top.name, confident: true };
      }
      return {
        status: 'mismatch' as const,
        loincName,
        derived: { loinc: top.loinc, name: top.name },
        suggestions: candidates,
        confident: true,
      };
    }
    // No confident derivation — fall back to name-overlap vs the code's own entry.
    if (!entry) {
      return { status: 'unknown-code' as const };
    }
    const printed = latinPart(item.analysis);
    const overlap = Math.max(
      tokenOverlap(printed, catalogNameText(entry)),
      tokenOverlap(catalogNameText(entry), printed)
    );
    if (overlap < MISMATCH_THRESHOLD) {
      return {
        status: 'mismatch' as const,
        loincName,
        suggestions: candidates.length > 0 ? candidates : undefined,
        confident: false,
      };
    }
    return { status: 'match' as const, loincName };
  });
}

// --- Stage 2: NLM Clinical Tables lookup ---

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

// EXAMPLE_UCUM_UNITS can list several units ("mg/dL;mmol/L").
function nlmUnitMatches(entry: NlmEntry, rowUnit: string): boolean {
  return (entry.unit ?? '').split(/[;,]/).some((u) => normalizeUnit(u) === rowUnit);
}

// The same unit selection as the local ladder, for NLM name-search results:
// entries agreeing with the row's unit win; ones contradicting it are dropped
// once any agreeing entry exists (unknown-unit entries are kept as fallback).
export function selectByUnit(entries: NlmEntry[], rowUnit: string | undefined): NlmEntry[] {
  const unit = normalizeUnit(rowUnit);
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
