import type { Result, Analysis } from '../types';
import { ALIAS_TO_PRIMARY, ALLOWED_UNITS, DEFAULT_UNITS } from './analyteCatalog';
import { fuzzyVocabHits, groupVocabByLength, tokensFuzzyEqual } from './fuzzyMatch';
import { dimensionOf, foldUnitGlyphs, toLatinUnit, type UnitDimension } from './unitNormalization';

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

// Trailing "." or "?" only ("mg/dL." → "mg/dl", "fL?" → "fl") — a manual scan
// instead of a trailing-quantifier regex, which backtracks super-linearly
// when the string ends in a long run of these chars with no match at $.
function trimTrailingUnitPunctuation(s: string): string {
  let end = s.length;
  while (end > 0 && (s[end - 1] === '.' || s[end - 1] === '?')) end -= 1;
  return s.slice(0, end);
}

// "mIU/L" ≈ "mu/l", "μIU/mL" ≈ "uu/ml", "x10³/µL" ≈ "x10^3/ul", "mg/dL." ≈ "mg/dl";
// IU and U are interchangeable lab spellings ("µU/mL" ≡ "µIU/mL"), and a
// curated unit marked uncertain ("fL?") reads as the unit itself. The
// superscript / micro / multiplication folding is unitNormalization's, shared
// rather than tabulated twice.
export function normalizeUnit(unit: string | undefined | null): string {
  return trimTrailingUnitPunctuation(
    foldUnitGlyphs(unit ?? '')
      .toLowerCase()
      .replaceAll('mcg', 'ug')
      .replaceAll('iu', 'u')
      .replace(/\s+/g, '')
  );
}

// μIU/mL ≡ mIU/L, pg/mL ≡ ng/L: a metric prefix over /mL is the same quantity
// as the prefix shifted up 1000× over /L — fold to the /L spelling so the two
// compare equal. /dL, /uL and prefixless numerators (IU/mL) are left alone.
const PREFIX_UP: Record<string, string> = { p: 'n', n: 'u', u: 'm', m: '' };

const CYRILLIC_RE = /\p{Script=Cyrillic}/u;

// A Cyrillic printed unit ("ммоль/л", "МЕ/мл", "тыс/мкл") matches nothing in the
// catalog, so transliterate it first. Only Cyrillic input takes this path.
function latinizeUnit(printed: string): string {
  if (!CYRILLIC_RE.test(printed)) return printed;
  return toLatinUnit(printed) ?? printed;
}

export function canonicalUnit(unit: string | undefined | null): string {
  // toLatinUnit and plain lab spellings both yield a bare "10^3/uL" where the
  // catalog writes count units "x10^3/uL", so the multiplier goes back on.
  const u = normalizeUnit(latinizeUnit(unit ?? '')).replace(/^10\^/, 'x10^');
  const m = /^([pnum])(\p{L}+)\/ml$/u.exec(u);
  return m ? `${PREFIX_UP[m[1]!]}${m[2]}/l` : u;
}

// Every known unit for a code, catalog reference unit first, then extras.
function catalogUnits(loinc: string, unitByLoinc: Record<string, string>): string[] {
  return [unitByLoinc[loinc], ...(ALLOWED_UNITS[loinc] ?? [])].filter((u): u is string => Boolean(u));
}

function knownUnits(loinc: string, unitByLoinc: Record<string, string>): string[] {
  return catalogUnits(loinc, unitByLoinc).map((u) => canonicalUnit(u));
}

// A candidate whose every known unit measures another kind of quantity than the
// row's (HbA1c's % against a hemoglobin row in g/L) is ruled out rather than
// down-ranked. A unit either side cannot place rules nothing out, and a scale of
// the same dimension (g/L against g/dL) is left to unitAdjust.
function contradictsRowUnit(
  rowDimension: UnitDimension | undefined,
  loinc: string,
  unitByLoinc: Record<string, string>
): boolean {
  if (!rowDimension) return false;
  const dimensions = new Set(catalogUnits(loinc, unitByLoinc).map((u) => dimensionOf(u)).filter(Boolean));
  return dimensions.size > 0 && !dimensions.has(rowDimension);
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

// Words printed beside an analyte's name that name no analyte themselves. They
// may still settle between siblings ("Whole Blood", "общий"), but a name met on
// them alone is no match, and a translation carrying one ("Холестерин общий")
// does not require the printout to repeat it.
const GENERIC_TOKENS = new Set([
  'acid',
  'acids',
  'total',
  'serum',
  'plasma',
  'blood',
  'level',
  'levels',
  'count',
  'кислота',
  'общий',
  'общая',
  'общее',
  'загальний',
  'загальна',
  'загальне',
]);

function isDecisive(token: string): boolean {
  return !GENERIC_TOKENS.has(token);
}

// A lab reports an -ic acid under its -ate anion (uric acid is urate, folic
// acid is folate), so a printed "Folic Acid" reads as the catalog's "folate".
function foldAcidToAnion(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const prev = out.at(-1);
    if ((t === 'acid' || t === 'acids') && prev && prev.length > 3 && prev.endsWith('ic')) {
      out[out.length - 1] = `${prev.slice(0, -2)}ate`;
    } else {
      out.push(t);
    }
  }
  return out;
}

// British ae/oe digraphs fold to the American spelling (haemoglobin →
// hemoglobin, oestradiol → estradiol) so en-GB printouts tokenize like the
// catalog's en-US names.
function plainTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ae|oe/g, 'e')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function tokensOf(text: string): string[] {
  return foldAcidToAnion(plainTokens(text));
}

// A catalog name answers to both spellings: "Uric Acid" folded alone would take
// "acid" out of the vocabulary, leaving "Acid Phosphatase" an unknown word that
// barely counts beside "phosphatase".
function nameTokensOf(text: string): string[] {
  const plain = plainTokens(text);
  return [...plain, ...foldAcidToAnion(plain)];
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
  const officialTokens = nameTokensOf(official);
  const officialSet = new Set(officialTokens);
  const matched = printedTokens.filter(
    (t) => officialSet.has(t) || officialTokens.some((o) => tokensFuzzyEqual(t, o))
  );
  return matched.some(isDecisive) ? matched.length / printedTokens.length : 0;
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
    for (const t of new Set(nameTokensOf(catalogNameText(a)))) {
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
function groupByAliasPrimary(ranked: CrossCheckSuggestion[]): Map<string, CrossCheckSuggestion[]> {
  const groups = new Map<string, CrossCheckSuggestion[]>();
  for (const s of ranked) {
    const primary = ALIAS_TO_PRIMARY[s.loinc] ?? s.loinc;
    const group = groups.get(primary);
    if (group) group.push(s);
    else groups.set(primary, [s]);
  }
  return groups;
}

// The unit picks the variant when it discriminates; otherwise the primary
// wins, but only for a same-scale group (see collapseAliasGroups above).
function pickAliasGroupMember(
  members: CrossCheckSuggestion[],
  primary: string,
  rowUnit: string,
  unitByLoinc: Record<string, string>
): CrossCheckSuggestion | undefined {
  const matching = rowUnit
    ? members.filter((m) => knownUnits(m.loinc, unitByLoinc).includes(rowUnit))
    : [];
  if (matching.length === 1) return matching[0];
  const units = new Set(members.flatMap((m) => knownUnits(m.loinc, unitByLoinc)));
  return units.size <= 1 ? (members.find((m) => m.loinc === primary) ?? members[0]) : undefined;
}

function collapseAliasGroups(
  ranked: CrossCheckSuggestion[],
  rowUnit: string,
  unitByLoinc: Record<string, string>
): CrossCheckSuggestion[] {
  const groups = groupByAliasPrimary(ranked);
  const out: CrossCheckSuggestion[] = [];
  for (const [primary, members] of groups) {
    if (members.length === 1) {
      out.push(members[0]!);
      continue;
    }
    const kept = pickAliasGroupMember(members, primary, rowUnit, unitByLoinc);
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
  const vocabByLen = groupVocabByLength(weights.keys());
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
      const officialTokens = new Set(nameTokensOf(catalogNameText(a)));
      const matched = queryTokens.filter((t) => tokenInfo.get(t)!.matches.some((m) => officialTokens.has(m)));
      const base = matched.some(isDecisive)
        ? matched.reduce((s, t) => s + tokenInfo.get(t)!.weight, 0) / totalWeight
        : 0;
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

function coverage(tokens: string[], by: Set<string>): number {
  return tokens.length === 0 ? 0 : tokens.filter((t) => by.has(t)).length / tokens.length;
}

function readingTokens(reading: string): string[] {
  return [...new Set(unicodeTokens(reading))];
}

// A translated name read whole, without its brackets, and as a bracket holding
// the entire printed name: a bracket is either a synonym a printout may use alone
// ("(ТТГ)") or a qualifier that only counts beside the rest ("(абс.)").
function nameReadings(name: string, queryTokens: string[]): string[][] {
  const synonyms = [...name.matchAll(/\(([^()]*)\)/g)]
    .map((m) => readingTokens(m[1]!))
    .filter((tokens) => queryTokens.every((t) => tokens.includes(t)));
  return [readingTokens(name), readingTokens(name.replace(/\([^()]*\)/g, ' ')), ...synonyms];
}

// The share of the printed name the translation covers stays the score; the
// share of the translation the printout leaves out discounts it by up to half,
// so a candidate carrying a qualifier the printout lacks ("Холестерин ЛПВП"
// against "Холестерин общий") falls behind one that carries none. A generic
// qualifier is not one the printout has to repeat.
function translationScore(queryTokens: string[], name: string): number {
  const nameTokens = new Set(unicodeTokens(name));
  if (!queryTokens.some((t) => isDecisive(t) && nameTokens.has(t))) return 0;
  const queryCoverage = coverage(queryTokens, nameTokens);
  const printed = new Set(queryTokens);
  const nameCoverage = Math.max(
    ...nameReadings(name, queryTokens).map((tokens) => coverage(tokens.filter(isDecisive), printed))
  );
  return (queryCoverage * (1 + nameCoverage)) / 2;
}

// Ladder stage b: the full printed name vs each catalog `lang` translation.
function stageLang(item: Result, entries: Analysis[], unitByLoinc: Record<string, string>): CrossCheckSuggestion[] {
  const queryTokens = unicodeTokens(item.analysis);
  if (queryTokens.length === 0) return [];
  const rowUnit = canonicalUnit(item.unit);
  return rankCandidates(
    entries.map((a) => {
      const base = Math.max(0, ...Object.values(a.lang ?? {}).map((name) => translationScore(queryTokens, name)));
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
  const rowDimension = item.unit ? dimensionOf(item.unit) : undefined;
  const compatible = entries.filter((a) => !contradictsRowUnit(rowDimension, a.loinc, unitByLoinc));
  let candidates = stageLatin(item, compatible, weights, unitByLoinc);
  if (candidates.length === 0) candidates = stageLang(item, compatible, unitByLoinc);
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

function nameKey(text: string): string {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ');
}

function unicodeOverlap(printed: string, official: string): number {
  const printedTokens = unicodeTokens(printed);
  if (printedTokens.length === 0) return 0;
  const officialTokens = new Set(unicodeTokens(official));
  const matched = printedTokens.filter((t) => officialTokens.has(t));
  return matched.some(isDecisive) ? matched.length / printedTokens.length : 0;
}

// A printed name agrees with a code when it is one of the code's own names —
// display, badge or a translation, up to case, spacing and punctuation — or
// shares a meaningful share of tokens with its English or translated names.
function printedNameAgrees(printed: string, entry: Analysis): boolean {
  const translations = Object.values(entry.lang ?? {});
  const key = nameKey(printed);
  if ([entry.displayName, entry.short, ...translations].some((name) => name && nameKey(name) === key)) return true;
  const latin = latinPart(printed);
  const official = catalogNameText(entry);
  if (Math.max(tokenOverlap(latin, official), tokenOverlap(official, latin)) >= MISMATCH_THRESHOLD) return true;
  return translations.some(
    (name) => Math.max(unicodeOverlap(printed, name), unicodeOverlap(name, printed)) >= MISMATCH_THRESHOLD
  );
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
    // A printed alias of the derived code (or vice versa) is the same analyte —
    // panels fold it via ALIAS_TO_PRIMARY — so it's a match.
    const primaryOf = (c: string) => ALIAS_TO_PRIMARY[c] ?? c;
    const agreesWithTop = top !== undefined && primaryOf(top.loinc) === primaryOf(code);
    // The derivation is the authority: a printed code is only evidence. When
    // the best derivation is the printed code, the row agrees even without
    // confidence, and there is nothing to offer in its place.
    if (agreesWithTop) {
      return { status: 'match' as const, loincName: loincName ?? top.name, ...(confident ? { confident } : {}) };
    }
    if (confident && top) {
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
    if (!printedNameAgrees(item.analysis, entry)) {
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
