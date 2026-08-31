import type { Result, Analysis } from '../types';
import { SHORT_LABELS, ALSO_REFS, ALIAS_TO_PRIMARY } from '../components/conditions/markers';

export const LOINC_RE = /^\d{1,7}-\d$/;

export type CrossCheckStatus = 'match' | 'mismatch' | 'unknown-code' | 'no-code' | 'malformed';

export interface CrossCheckSuggestion {
  loinc: string;
  name: string;
  score: number;
  // Name-overlap score before the unit adjustment — the rank floor uses this,
  // so a unit contradiction dents the ranking but can't hide a strong name hit.
  baseScore?: number;
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

// "mIU/L" ≈ "mu/l", "μIU/mL" ≈ "uu/ml", "x10^3/μL" ≈ "x10^3/ul", "mg/dL." ≈ "mg/dl";
// IU and U are interchangeable lab spellings ("µU/mL" ≡ "µIU/mL"), and a
// curated unit marked uncertain ("fL?") reads as the unit itself.
export function normalizeUnit(unit: string | undefined | null): string {
  return (unit ?? '')
    .toLowerCase()
    .replace(/[μµ]/g, 'u')
    .replace(/mcg/g, 'ug')
    .replace(/iu/g, 'u')
    .replace(/\s+/g, '')
    .replace(/[.?]+$/, '');
}

// μIU/mL ≡ mIU/L, pg/mL ≡ ng/L: a metric prefix over /mL is the same quantity
// as the prefix shifted up 1000× over /L — fold to the /L spelling so the two
// compare equal. /dL, /uL and prefixless numerators (IU/mL) are left alone.
const PREFIX_UP: Record<string, string> = { p: 'n', n: 'u', u: 'm', m: '' };

export function canonicalUnit(unit: string | undefined | null): string {
  const u = normalizeUnit(unit);
  const m = /^([pnum])(\p{L}+)\/ml$/u.exec(u);
  return m ? `${PREFIX_UP[m[1]!]}${m[2]}/l` : u;
}

// Conventional units for catalog analytes absent from the curated marker
// tables — without an entry a candidate takes no unit penalty, so e.g. IGF-1
// ("Insulin-like growth factor") survives against Insulin on a µIU/mL row.
export const SUPPLEMENTARY_UNITS: Record<string, string> = {
  '2484-4': 'ng/mL',
};

// Known reference unit per LOINC, from the curated marker tables — this is what
// lets the row's unit pick the right variant of a multi-code analyte.
export const DEFAULT_UNITS: Record<string, string> = {
  ...SUPPLEMENTARY_UNITS,
  ...Object.fromEntries(Object.entries(SHORT_LABELS).map(([loinc, v]) => [loinc, v.unit])),
  ...Object.fromEntries(
    Object.values(ALSO_REFS)
      .flat()
      .map((ref) => [ref.loinc, ref.unit])
  ),
};

// A LOINC code fixes the kind of quantity, not the scale — LOINC's own example
// units for 1848-1 (DHT) list both ng/dL and pg/mL. Extra accepted units per
// code, beyond the curated primary in DEFAULT_UNITS.
export const ALLOWED_UNITS: Record<string, string[]> = {
  '1848-1': ['pg/mL'],
};

// Every known unit for a code (curated primary first, then extras), canonicalized.
function knownUnits(loinc: string, unitByLoinc: Record<string, string>): string[] {
  return [unitByLoinc[loinc], ...(ALLOWED_UNITS[loinc] ?? [])]
    .filter((u): u is string => Boolean(u))
    .map((u) => canonicalUnit(u));
}

// undefined — we know nothing about the code's units; true — the unit matches
// the DEFAULT_UNITS entry or any ALLOWED_UNITS member; false otherwise.
export function unitAllowed(loinc: string, unit: string): boolean | undefined {
  const known = knownUnits(loinc, DEFAULT_UNITS);
  if (known.length === 0) return undefined;
  return known.includes(canonicalUnit(unit));
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

// British ae/oe digraphs fold to the American spelling (haemoglobin →
// hemoglobin, oestradiol → estradiol) so en-GB printouts tokenize like the
// catalog's en-US names.
function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ae|oe/g, 'e')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

// --- Fuzzy token equality (lab typos: CORTIZOL, Thyroxin) ---

// Two tokens count as equal when identical, or within Damerau-Levenshtein
// distance 1 for length ≥ 5 (both sides), or distance 2 for length ≥ 9.
// Short tokens get no slack — "hb" must never equal "hgb" by accident.
const FUZZY1_MIN_LEN = 5;
const FUZZY2_MIN_LEN = 9;

function fuzzyCap(a: string, b: string): number {
  const shorter = Math.min(a.length, b.length);
  if (shorter >= FUZZY2_MIN_LEN) return 2;
  if (shorter >= FUZZY1_MIN_LEN) return 1;
  return 0;
}

// Optimal-string-alignment Damerau-Levenshtein, early-exiting once a whole
// row exceeds the cap.
function editDistanceWithin(a: string, b: string, cap: number): boolean {
  if (cap <= 0) return false;
  if (Math.abs(a.length - b.length) > cap) return false;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2]! + 1);
      }
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > cap) return false;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]! <= cap;
}

function tokensFuzzyEqual(a: string, b: string): boolean {
  return a === b || editDistanceWithin(a, b, fuzzyCap(a, b));
}

// Catalog vocabulary grouped by token length, so a fuzzy lookup only compares
// against tokens whose length is within the allowed edit distance.
function groupVocabByLength(weights: Map<string, number>): Map<number, string[]> {
  const byLen = new Map<number, string[]>();
  for (const t of weights.keys()) {
    const group = byLen.get(t.length);
    if (group) group.push(t);
    else byLen.set(t.length, [t]);
  }
  return byLen;
}

function fuzzyVocabHits(token: string, vocabByLen: Map<number, string[]>): string[] {
  const hits: string[] = [];
  for (let len = token.length - 2; len <= token.length + 2; len++) {
    const group = vocabByLen.get(len);
    if (!group) continue;
    const shorter = Math.min(token.length, len);
    const cap = shorter >= FUZZY2_MIN_LEN ? 2 : shorter >= FUZZY1_MIN_LEN ? 1 : 0;
    if (cap === 0 || Math.abs(token.length - len) > cap) continue;
    for (const v of group) {
      if (v !== token && editDistanceWithin(token, v, cap)) hits.push(v);
    }
  }
  return hits;
}

// Any-script tokenizer for the translation pass — Greek/Cyrillic printed names
// must not be stripped there.
function unicodeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

// Fraction of `printed` tokens found among `official` tokens (0..1), with
// fuzzy equality so "Haemoglobin"/"CORTIZOL" still overlap their entries.
export function tokenOverlap(printed: string, official: string): number {
  const printedTokens = tokensOf(printed);
  if (printedTokens.length === 0) return 0;
  const officialTokens = tokensOf(official);
  const officialSet = new Set(officialTokens);
  const matched = printedTokens.filter(
    (t) => officialSet.has(t) || officialTokens.some((o) => tokensFuzzyEqual(t, o))
  ).length;
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
const UNKNOWN_TOKEN_WEIGHT = 0.25;

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

// A candidate whose known units include the row's is boosted; one whose known
// units all contradict it is heavily penalized — the unit hard-selects among
// same-named variants (e.g. Prolactin mIU/L vs ng/mL).
function unitAdjust(base: number, rowUnit: string, candUnits: string[]): number {
  if (base <= 0 || !rowUnit || candUnits.length === 0) return base;
  // Multiplicative, so the unit signal scales with name similarity instead of
  // lifting a weak name hit past a strong one.
  return candUnits.includes(rowUnit) ? base * 1.3 : base * 0.3;
}

// Rank floor applies to the PRE-unit-adjust name score: a strong name hit
// whose curated unit contradicts the row's (e.g. FT4 ng/L vs ng/dL) must
// still surface as a suggestion — the penalty only demotes it from confident.
// 0.45 (not lower) keeps common-token junk out: "Risk Factor Index" matching
// TNF-alpha on "factor" alone stays under the floor.
const RANK_FLOOR = 0.45;

// A primary and its own ALSO_REFS aliases are one analyte, not competing
// suggestions — collapse them into a single candidate. The kept code is the
// group member whose known unit matches the row's (the unit picks the variant;
// panels still join via ALIAS_TO_PRIMARY, so e.g. SHBG nmol/L keeps 13967-5).
// When the unit doesn't discriminate (no row unit, or several members match),
// fall back to the primary — but only for same-scale groups (one shared
// canonical unit, e.g. Glucose 2339-0/2345-7 both mg/dL). Different-scale
// variants with no deciding unit (Prolactin mIU/L vs ng/mL on a unitless row)
// stay separate: only the unit tells them apart.
function collapseAliasGroups(
  ranked: CrossCheckSuggestion[],
  rowUnit: string,
  unitByLoinc: Record<string, string>
): CrossCheckSuggestion[] {
  const groups = new Map<string, CrossCheckSuggestion[]>();
  for (const s of ranked) {
    const primary = ALIAS_TO_PRIMARY[s.loinc] ?? s.loinc;
    const group = groups.get(primary);
    if (group) group.push(s);
    else groups.set(primary, [s]);
  }
  const out: CrossCheckSuggestion[] = [];
  for (const [primary, members] of groups) {
    if (members.length === 1) {
      out.push(members[0]!);
      continue;
    }
    const matching = rowUnit
      ? members.filter((m) => knownUnits(m.loinc, unitByLoinc).includes(rowUnit))
      : [];
    let kept: CrossCheckSuggestion | undefined;
    if (matching.length === 1) {
      kept = matching[0];
    } else {
      const units = new Set(members.flatMap((m) => knownUnits(m.loinc, unitByLoinc)));
      if (units.size <= 1) kept = members.find((m) => m.loinc === primary) ?? members[0];
    }
    if (!kept) {
      out.push(...members);
      continue;
    }
    out.push({
      ...kept,
      score: Math.max(...members.map((m) => m.score)),
      baseScore: Math.max(...members.map((m) => m.baseScore ?? m.score)),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

function rankCandidates(
  scored: CrossCheckSuggestion[],
  rowUnit: string,
  unitByLoinc: Record<string, string>
): CrossCheckSuggestion[] {
  const ranked = scored
    .filter((s) => (s.baseScore ?? s.score) > RANK_FLOOR)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    // When the best candidate clearly dominates, weaker share-a-token hits
    // (e.g. "Total Cholesterol" for an "HDL Cholesterol" row) are noise.
    .filter((s, _i, all) => s.score >= all[0]!.score * 0.75);
  return collapseAliasGroups(ranked, rowUnit, unitByLoinc);
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
  const rowUnit = canonicalUnit(item.unit);
  const queryTokens = tokensOf(name);
  const vocabByLen = groupVocabByLength(weights);
  // Per query token: every catalog token it counts as (itself + fuzzy hits)
  // and its weight. A fuzzy-known token borrows its best match's weight; a
  // token the whole catalog has never seen ("3rd", "total") can't
  // discriminate anything, so it barely counts instead of diluting the score.
  const tokenInfo = new Map(
    queryTokens.map((t) => {
      const hits = fuzzyVocabHits(t, vocabByLen);
      const weight =
        weights.get(t) ??
        (hits.length > 0 ? Math.max(...hits.map((h) => weights.get(h)!)) : UNKNOWN_TOKEN_WEIGHT);
      return [t, { matches: [t, ...hits], weight }] as const;
    })
  );
  const totalWeight = queryTokens.reduce((s, t) => s + tokenInfo.get(t)!.weight, 0);
  if (totalWeight === 0) return [];
  return rankCandidates(
    entries.map((a) => {
      const officialTokens = new Set(tokensOf(catalogNameText(a)));
      const base =
        queryTokens
          .filter((t) => tokenInfo.get(t)!.matches.some((m) => officialTokens.has(m)))
          .reduce((s, t) => s + tokenInfo.get(t)!.weight, 0) / totalWeight;
      return {
        loinc: a.loinc,
        name: a.displayName || a.longCommonName,
        score: unitAdjust(base, rowUnit, knownUnits(a.loinc, unitByLoinc)),
        baseScore: base,
        unit: unitByLoinc[a.loinc],
      };
    }),
    rowUnit,
    unitByLoinc
  );
}

// Ladder stage b: the full printed name vs catalog `lang` translations.
function stageLang(item: Result, entries: Analysis[], unitByLoinc: Record<string, string>): CrossCheckSuggestion[] {
  const queryTokens = unicodeTokens(item.analysis);
  if (queryTokens.length === 0) return [];
  const rowUnit = canonicalUnit(item.unit);
  return rankCandidates(
    entries.map((a) => {
      const langTokens = new Set(unicodeTokens(Object.values(a.lang ?? {}).join(' ')));
      const base =
        langTokens.size === 0 ? 0 : queryTokens.filter((t) => langTokens.has(t)).length / queryTokens.length;
      return {
        loinc: a.loinc,
        name: a.displayName || a.longCommonName,
        score: unitAdjust(base, rowUnit, knownUnits(a.loinc, unitByLoinc)),
        baseScore: base,
        unit: unitByLoinc[a.loinc],
      };
    }),
    rowUnit,
    unitByLoinc
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
  const rowUnit = canonicalUnit(item.unit);
  const candUnits = knownUnits(top.loinc, unitByLoinc);
  return !rowUnit || candUnits.length === 0 || candUnits.includes(rowUnit);
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
      // A printed alias of the derived code (or vice versa) is the same
      // analyte — panels fold it via ALIAS_TO_PRIMARY — so it's a match.
      const primaryOf = (c: string) => ALIAS_TO_PRIMARY[c] ?? c;
      if (top.loinc === code || primaryOf(top.loinc) === primaryOf(code)) {
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
