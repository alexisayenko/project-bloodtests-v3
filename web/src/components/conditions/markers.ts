import { MARKER_LOINC, type IndexDef } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import { ALIAS_TO_PRIMARY, ALSO_REFS, SHORT_NAMES } from '../../data/analyteCatalog';
import type { Analysis, LoincRef, MonitoringPanelDef, Panel } from '../../types';

export { ALIAS_TO_PRIMARY, ALSO_REFS, SHORT_NAMES } from '../../data/analyteCatalog';
export type { LoincRef, MonitoringPanelDef } from '../../types';

export type Observation = { shortName: string; friendlyName: string; longCommonName: string; loinc: string; unit?: string; also?: LoincRef[] };

// Computed/derived values (ratios, estimates) rather than direct measurements. TC/HDL
// ratio and % Iron Saturation are also independently reportable by a lab (LOINCs
// 9830-1, 2502-3) but are shown via COMPUTED_LOINCS's own formula instead once one
// applies -- kept here only so they never show as raw badges in the grid. eGFR
// (48642-3) has no computed twin (needs age, which v3 doesn't have) and stays
// purely lab-reported.
export const INDEX_LOINCS = new Set(['9830-1', '2502-3', '48642-3']);

// LOINCs that a computed index (see computedIndices.ts) can independently
// duplicate from a lab report -- excluded from the raw-LOINC Indices table so
// each one renders once, via its computed row, not twice.
export const COMPUTED_LOINCS = new Set(INDEX_DEFS.map((d) => d.loinc).filter((x): x is string => !!x));

// Reverse of MARKER_LOINC, for looking up an observation's SI/US conversion by
// whichever LOINC it happens to be recorded under.
export const LOINC_TO_MARKER: Record<string, string> = Object.fromEntries(
  Object.entries(MARKER_LOINC).flatMap(([marker, loincs]) => loincs.map((loinc) => [loinc, marker]))
);

export function getPanelLoincs(panel: Panel): string[] {
  if (panel.sections) return panel.sections.flatMap((section) => section.loincs);
  return panel.loincs ?? [];
}

/** The code a reading folds into for display: an alias resolves to its primary. */
export function primaryLoinc(loinc: string): string {
  return ALIAS_TO_PRIMARY[loinc] ?? loinc;
}

/**
 * The row keys a panel covers, for filtering an alias-folded table by panel.
 * buildConditions maps LOINCs one-to-one on purpose, so a panel names whichever
 * code of an alias group it means (Insulin Resistance keeps HbA1c's NGSP code
 * and drops the IFCC one); rows fold onto the primary, so both sides must fold
 * before matching or a reading recorded under the other code is lost.
 */
export function panelRowLoincs(tests: Observation[]): Set<string> {
  return new Set(tests.flatMap(testLoincs).map(primaryLoinc));
}

/**
 * All Observations' free-text filter. Matched against the short name, the
 * friendly name, the LOINC name (longCommonName), every LOINC the row answers for
 * and every raw name a lab actually printed for it -- the raw names are what make
 * "Гемоглобин" and "HGB" find the same row on Cyrillic reports.
 */
export function observationMatchesQuery(test: Observation, query: string, rawNames: readonly string[] = []): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [test.shortName, test.friendlyName, test.longCommonName, ...testLoincs(test), ...rawNames].some((s) =>
    s.toLowerCase().includes(q)
  );
}

/** Every name a lab printed, indexed by the row key those names belong to. */
export function buildRawNames(allResults: readonly { loinc: string; result: { rawName?: string } }[]): Record<string, string[]> {
  const byLoinc: Record<string, string[]> = {};
  for (const { loinc, result } of allResults) {
    const name = result.rawName;
    if (!name) continue;
    const key = primaryLoinc(loinc);
    const names = (byLoinc[key] ??= []);
    if (!names.includes(name)) names.push(name);
  }
  return byLoinc;
}

/** The raw names of every code a row answers for, ready for observationMatchesQuery. */
export function rawNamesOf(index: Record<string, string[]>, test: Observation): string[] {
  return testLoincs(test).flatMap((loinc) => index[primaryLoinc(loinc)] ?? []);
}

/** The same filter over a computed index, which has no LOINC or printed name of its own. */
export function indexMatchesQuery(def: IndexDef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [def.friendlyName, def.shortName, def.key].some((s) => s.toLowerCase().includes(q));
}

/** All LOINCs an observation's row/badge answers for: its own plus its also-refs. */
export function testLoincs(test: Observation): string[] {
  return [test.loinc, ...(test.also?.map((ref) => ref.loinc) ?? [])];
}

// True when echoing `shortName` beside `friendlyName` would add nothing: the
// friendly name already contains it (ignoring case and punctuation, so "25OH"
// matches "(25-OH)"), or each word of the short name abbreviates a word of the
// friendly name in order ("Vit D" ⊂ "Vitamin D (25-OH)").
export function isEchoRedundant(friendlyName: string, shortName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (norm(friendlyName).includes(norm(shortName))) return true;
  const fullWords = friendlyName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const shortWords = shortName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let i = 0;
  for (const w of shortWords) {
    while (i < fullWords.length && !fullWords[i]!.startsWith(w)) i++;
    if (i === fullWords.length) return false;
    i++;
  }
  return true;
}


/** Which Monitoring Panels name a LOINC outright — one-to-one, as buildConditions resolves it. */
export function buildPanelsByLoinc(conditions: readonly { name: string; tests: Observation[] }[]): Record<string, string[]> {
  const byLoinc: Record<string, string[]> = {};
  for (const condition of conditions) {
    for (const test of condition.tests) {
      const names = (byLoinc[test.loinc] ??= []);
      if (!names.includes(condition.name)) names.push(condition.name);
    }
  }
  return byLoinc;
}

/**
 * A code's panel standing. buildConditions maps LOINCs one-to-one on purpose, so
 * a variant code names no panel of its own even when the analyte it folds into
 * sits in several -- reporting that as "no panels" would contradict what the user
 * sees, since rows fold through primaryLoinc before a panel matches them. So an
 * unlisted variant reports its primary's panels and says whose they are.
 */
export function panelMembershipOf(
  panelsByLoinc: Record<string, string[]>,
  loinc: string
): { panels: string[]; via?: string } {
  const direct = panelsByLoinc[loinc];
  if (direct?.length) return { panels: direct };
  const primary = primaryLoinc(loinc);
  if (primary === loinc) return { panels: [] };
  return { panels: panelsByLoinc[primary] ?? [], via: primary };
}

/**
 * The Monitoring Panels grid model: each definition from monitoring-panels.json
 * resolved against the lab groups in panels.json and the analyte catalog.
 */
export function buildConditions(
  panels: Panel[],
  analysesCatalog: Record<string, Analysis>,
  monitoringPanels: MonitoringPanelDef[]
): { name: string; tests: Observation[] }[] {
  return monitoringPanels.map((def) => {
    let loincs: string[];
    if (def.panelIds) {
      loincs = def.panelIds.flatMap((id) => {
        const panel = panels.find((p) => p.id === id);
        return panel ? getPanelLoincs(panel) : [];
      });
    } else if (def.panelId) {
      const panel = panels.find((p) => p.id === def.panelId);
      loincs = panel ? getPanelLoincs(panel) : [];
    } else {
      loincs = def.loincs ?? [];
    }
    if (def.excludeLoincs) {
      loincs = loincs.filter((loinc) => !def.excludeLoincs!.includes(loinc));
    }
    loincs = [...loincs, ...(def.extraLoincs ?? [])];
    const tests: Observation[] = loincs.map((loinc) => {
      const analysis = analysesCatalog[loinc];
      const labelInfo = SHORT_NAMES[loinc];
      return {
        shortName: labelInfo?.shortName ?? analysis?.friendlyName ?? loinc,
        friendlyName: analysis?.friendlyName ?? loinc,
        longCommonName: analysis?.longCommonName ?? '',
        loinc,
        unit: labelInfo?.unit,
        also: ALSO_REFS[loinc],
      };
    });
    return { name: def.name, tests };
  });
}
