import { MARKER_LOINC, type IndexDef } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import { ALIAS_TO_PRIMARY, ALSO_REFS, SHORT_NAMES } from '../../data/analyteCatalog';
import type { Analysis, LoincRef, MonitoringPanelDef, Panel } from '../../types';

export { ALIAS_TO_PRIMARY, ALSO_REFS, SHORT_NAMES } from '../../data/analyteCatalog';
export type { LoincRef, MonitoringPanelDef } from '../../types';

export type Observation = { shortName: string; friendlyName: string; longCommonName: string; loinc: string; unit?: string; also?: LoincRef[] };

// Lab-reportable codes that a computed index supersedes, so they never show as raw badges; eGFR (48642-3)
// and ACR (9318-7) have no computed twin (eGFR needs age, ACR needs a paired urine albumin/creatinine) and
// stay lab-reported.
export const INDEX_LOINCS = new Set(['9830-1', '2502-3', '48642-3', '9318-7']);

// Excluded from the raw-LOINC Indices table so each renders once, via its computed row.
export const COMPUTED_LOINCS = new Set(INDEX_DEFS.map((d) => d.loinc).filter((x): x is string => !!x));

function getPanelLoincs(panel: Panel): string[] {
  if (panel.sections) return panel.sections.flatMap((section) => section.loincs);
  return panel.loincs ?? [];
}

/** The code a reading folds into for display: an alias resolves to its primary. */
export function primaryLoinc(loinc: string): string {
  return ALIAS_TO_PRIMARY[loinc] ?? loinc;
}

/** Rows fold onto the primary, so the panel's codes must fold too or a reading under an alias is lost. */
export function panelRowLoincs(tests: Observation[]): Set<string> {
  return new Set(tests.flatMap(testLoincs).map(primaryLoinc));
}

/** Matches printed raw names too, so "Гемоглобин" and "HGB" find the same row. */
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

/** Newest first; includes dates carrying only an input of one of the panel's indices. */
export function panelDates(name: string, tests: readonly Observation[], allResults: readonly { loinc: string; date: string }[]): string[] {
  const computedInputLoincs = new Set(
    INDEX_DEFS.filter((d) => d.panels.includes(name)).flatMap((d) => d.inputKeys.flatMap((inputKey) => MARKER_LOINC[inputKey] ?? []))
  );
  return Array.from(
    new Set(
      allResults
        .filter((r) => tests.some((t) => testLoincs(t).includes(r.loinc)) || computedInputLoincs.has(r.loinc))
        .map((r) => r.date)
    )
  ).sort((a, b) => b.localeCompare(a));
}

/** All LOINCs an observation's row/badge answers for: its own plus its also-refs. */
export function testLoincs(test: Observation): string[] {
  return [test.loinc, ...(test.also?.map((ref) => ref.loinc) ?? [])];
}

// True when the friendly name already contains or abbreviates the short name ("Vit D" ⊂ "Vitamin D (25-OH)").
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

/** An unlisted variant reports its primary's panels and says whose they are, matching what the folded rows show. */
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

/** Resolves monitoring-panels.json over panels.json and the catalog, mapping LOINCs one-to-one (no alias folding). */
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
