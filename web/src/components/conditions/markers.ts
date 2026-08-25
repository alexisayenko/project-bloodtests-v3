import { INDEX_DEFS, MARKER_LOINC } from '../../data/computedIndices';
import type { Analysis, Panel } from '../../types';

export type LoincRef = { label: string; loinc: string; longCommonName: string; unit: string };
export type Observation = { short: string; full: string; longCommonName: string; loinc: string; unit?: string; also?: LoincRef[] };

export type PanelDef = { name: string; panelId?: string; panelIds?: string[]; loincs?: string[]; excludeLoincs?: string[]; extraLoincs?: string[] };

export const PANEL_DEFS: PanelDef[] = [
  { name: 'Hypogonadism', panelId: 'hpg-axis', extraLoincs: ['1751-7', '2276-4', '11580-8', '5763-8', '1989-3', '4548-4'] },
  { name: 'Hypothyroidism', panelId: 'thyroid', extraLoincs: ['1989-3'] },
  { name: 'Adrenal', panelId: 'hpa-axis', extraLoincs: ['2191-5'] },
  { name: 'Insulin Resistance', panelId: 'glucose-metabolism', excludeLoincs: ['1798-8', '3040-3', '59261-8'], extraLoincs: ['2571-8', '2085-9'] },
  { name: 'Cardiovascular Risk', panelIds: ['cardiovascular-inflammatory', 'lipid-metabolism'] },
  { name: 'Fatty Liver', panelId: 'liver-function', extraLoincs: ['777-3', '2571-8', '4548-4', '2339-0'] },
  { name: 'Kidney Function', panelId: 'kidney-function', extraLoincs: ['2951-2', '2823-3', '2075-0', '17861-6', '2777-1', '1751-7', '2339-0', '9318-7'] },
  { name: 'Anemia', panelId: 'iron-metabolism', extraLoincs: ['787-2', '785-6', '786-4', '788-0', '2132-9', '2284-8'] },
  { name: 'Bone and Mineral Metabolism', panelId: 'vitamins-minerals-electrolytes', extraLoincs: ['2697-1', '41171-0', '77370-5', '9622-2', '17838-4', '6768-6', '1751-7'] },
  { name: 'Pancreatic Function', loincs: ['1798-8', '3040-3'], extraLoincs: ['25907-7', '2339-0', '4548-4', '20448-7', '2571-8', '17861-6', '6768-6', '2324-2', '1975-2', '1968-7', '1986-9'] },
  { name: 'FBC', panelId: 'fbc' },
];

// No `short`/`unit` field exists in the real catalog data — keep the short badge
// labels and reference units as a local lookup, keyed by loinc.
export const SHORT_LABELS: Record<string, { short: string; unit: string }> = {
  // Hypogonadism
  '14913-8': { short: 'T', unit: 'nmol/L' },
  '2991-8': { short: 'FT', unit: 'pg/mL' },
  '10501-5': { short: 'LH', unit: 'mIU/mL' },
  '15067-2': { short: 'FSH', unit: 'mIU/mL' },
  '15081-3': { short: 'PRL', unit: 'ng/mL' },
  '2942-1': { short: 'SHBG', unit: 'nmol/L' },
  '2243-4': { short: 'E2', unit: 'pg/mL' },
  '1848-1': { short: 'DHT', unit: 'ng/dL' },
  '2191-5': { short: 'DHEA-S', unit: 'mcg/dL' },
  // Hypothyroidism
  '11580-8': { short: 'TSH', unit: 'mIU/L' },
  '3051-0': { short: 'FT3', unit: 'pg/mL' },
  '3024-7': { short: 'FT4', unit: 'ng/dL' },
  '8099-4': { short: 'TPO', unit: 'IU/mL' },
  '8098-6': { short: 'TG', unit: 'IU/mL' },
  '5385-0': { short: 'TRAb', unit: 'IU/L' },
  '1992-7': { short: 'CT', unit: 'pg/mL' },
  // Adrenal
  '2141-0': { short: 'ACTH', unit: 'pg/mL' },
  '2143-6': { short: 'CORT', unit: 'mcg/dL' },
  // Insulin Resistance
  '20448-7': { short: 'INS', unit: 'uIU/mL' },
  '2339-0': { short: 'GLU', unit: 'mg/dL' },
  '4548-4': { short: 'HbA1c', unit: '%' },
  '13979-8': { short: 'GA', unit: '%' },
  '1557-8': { short: 'FRA', unit: 'umol/L' },
  '1986-9': { short: 'C-P', unit: 'ng/mL' },
  // Cardiovascular Risk
  '1988-5': { short: 'CRP', unit: 'mg/L' },
  '30522-7': { short: 'hsCRP', unit: 'mg/L' },
  '26881-3': { short: 'IL6', unit: 'pg/mL' },
  '3167-4': { short: 'TNF-α', unit: 'pg/mL' },
  '49246-0': { short: 'oxLDL', unit: 'U/L' },
  '21365-2': { short: 'LEP', unit: 'ng/mL' },
  '56660-9': { short: 'ADIPO', unit: 'mcg/mL' },
  '13965-9': { short: 'HCY', unit: 'umol/L' },
  '3255-7': { short: 'FIB', unit: 'mg/dL' },
  '2093-3': { short: 'TC', unit: 'mg/dL' },
  '2085-9': { short: 'HDL-C', unit: 'mg/dL' },
  '13457-7': { short: 'LDL-C', unit: 'mg/dL' },
  '2571-8': { short: 'TRIG', unit: 'mg/dL' },
  '9830-1': { short: 'TC/HDL', unit: 'ratio' },
  '1884-6': { short: 'ApoB', unit: 'mg/dL' },
  '1869-7': { short: 'ApoA1', unit: 'mg/dL' },
  '10835-7': { short: 'Lp(a)', unit: 'mg/dL' },
  // Fatty Liver
  '6768-6': { short: 'ALP', unit: 'U/L' },
  '1968-7': { short: 'DBIL', unit: 'mg/dL' },
  '1971-1': { short: 'IBIL', unit: 'mg/dL' },
  '1975-2': { short: 'TBIL', unit: 'mg/dL' },
  '1920-8': { short: 'AST', unit: 'U/L' },
  '1742-6': { short: 'ALT', unit: 'U/L' },
  '2324-2': { short: 'GGT', unit: 'U/L' },
  '2710-2': { short: 'PChE', unit: 'U/L' },
  '5195-3': { short: 'HBsAg', unit: 'Positive/Negative' },
  '16128-1': { short: 'HCV', unit: 'Positive/Negative' },
  '1751-7': { short: 'ALB', unit: 'g/dL' },
  '10834-0': { short: 'GLOB', unit: 'g/dL' },
  '2885-2': { short: 'TP', unit: 'g/dL' },
  // Kidney Function
  '3094-0': { short: 'Urea', unit: 'mg/dL' },
  '2160-0': { short: 'CREA', unit: 'mg/dL' },
  '3084-1': { short: 'UA', unit: 'mg/dL' },
  '48642-3': { short: 'eGFR', unit: 'mL/min/1.73m2' },
  '33863-2': { short: 'CYSC', unit: 'mg/L' },
  '9318-7': { short: 'ACR', unit: 'mg/g' }, // Albumin/Creatinine ratio, urine
  // Anemia
  '789-8': { short: 'RBC', unit: 'x10^6/uL' },
  '718-7': { short: 'Hb', unit: 'g/dL' },
  '4544-3': { short: 'HCT', unit: '%' },
  '2498-4': { short: 'Fe', unit: 'mcg/dL' },
  '2276-4': { short: 'Ferr', unit: 'ng/mL' },
  '2500-7': { short: 'TIBC', unit: 'mcg/dL' },
  '2501-5': { short: 'UIBC', unit: 'mcg/dL' },
  '3034-6': { short: 'TRF', unit: 'mg/dL' },
  '2502-3': { short: 'TSAT', unit: '%' },
  // Bone and Mineral Metabolism
  '2998-3': { short: 'Vit B1', unit: 'nmol/L' },
  '30552-4': { short: 'Vit B6', unit: 'nmol/L' },
  '2284-8': { short: 'Vit B9', unit: 'ng/mL' },
  '2132-9': { short: 'Vit B12', unit: 'pg/mL' },
  '1989-3': { short: 'Vit D', unit: 'ng/mL' },
  '17861-6': { short: 'Ca', unit: 'mg/dL' },
  '1994-3': { short: 'iCa', unit: 'mmol/L' },
  '2075-0': { short: 'Cl', unit: 'mmol/L' },
  '2777-1': { short: 'P', unit: 'mg/dL' },
  '2823-3': { short: 'K', unit: 'mmol/L' },
  '19123-9': { short: 'Mg', unit: 'mg/dL' },
  '29900-7': { short: 'Mg RBC', unit: 'mg/dL' },
  '2951-2': { short: 'Na', unit: 'mmol/L' },
  '5763-8': { short: 'Zn', unit: 'mcg/dL' },
  '2731-8': { short: 'PTH', unit: 'pg/mL' },
  // Bone turnover markers
  '2697-1': { short: 'OC', unit: 'ng/mL' }, // Osteocalcin
  '41171-0': { short: 'CTX', unit: 'ng/mL' }, // Beta-CrossLaps/CTX
  '77370-5': { short: 'P1NP', unit: 'ng/mL' }, // Procollagen type I N-terminal propeptide
  '9622-2': { short: 'Vit K', unit: 'ng/mL' }, // Vitamin K1
  '17838-4': { short: 'BALP', unit: 'ug/L' }, // Bone-specific alkaline phosphatase
  // Pancreatic Function
  '1798-8': { short: 'AMY', unit: 'U/L' },
  '3040-3': { short: 'LIP', unit: 'U/L' },
  '25907-7': { short: 'ELA1', unit: 'ug/g' }, // Pancreatic elastase-1, stool
  // Not in any panel yet — labeled so All Observations shows them readably.
  '2465-3': { short: 'IgG', unit: 'mg/dL' },
  '2862-1': { short: 'IgA', unit: 'mg/dL' },
  '4537-7': { short: 'ESR', unit: 'mm/hr' },
  '48066-5': { short: 'D-Dim', unit: 'ng/mL' },
  '62418-9': { short: 'Glu/Ins', unit: 'ratio' },
  // FBC — Leukocytes and Differentials
  '6690-2': { short: 'WBC', unit: 'x10^3/uL' },
  '751-8': { short: 'NEUT#', unit: 'x10^3/uL' },
  '731-0': { short: 'LYMPH#', unit: 'x10^3/uL' },
  '742-7': { short: 'MONO#', unit: 'x10^3/uL' },
  '711-2': { short: 'EOS#', unit: 'x10^3/uL' },
  '704-7': { short: 'BASO#', unit: 'x10^3/uL' },
  '770-8': { short: 'NEUT%', unit: '%' },
  '736-9': { short: 'LYMPH%', unit: '%' },
  '5905-5': { short: 'MONO%', unit: '%' },
  '713-8': { short: 'EOS%', unit: '%' },
  '706-2': { short: 'BASO%', unit: '%' },
  // FBC — Erythrocytes (789-8, 718-7, 4544-3 already defined above under Anemia)
  '787-2': { short: 'MCV', unit: 'fL' },
  '785-6': { short: 'MCH', unit: 'pg' },
  '786-4': { short: 'MCHC', unit: 'g/dL' },
  '788-0': { short: 'RDW', unit: '%' },
  '21000-5': { short: 'RDW-SD', unit: 'fL?' },
  // FBC — Platelets
  '777-3': { short: 'PLT', unit: 'x10^3/uL' },
  '32623-1': { short: 'MPV', unit: 'fL' },
  '32207-3': { short: 'PDW', unit: 'fL?' },
  '58410-2': { short: 'P-LCR', unit: '%?' },
  '74464-9': { short: 'P-LCC', unit: 'x10^3/uL?' },
  '61928-1': { short: 'PCT', unit: '%?' },
};

// Manually curated cross-references (not sourced from panels.json).
export const ALSO_REFS: Record<string, LoincRef[]> = {
  '14913-8': [{ label: 'ng/dL unit', loinc: '2986-8', longCommonName: 'Testosterone [Mass/volume] in Serum or Plasma', unit: 'ng/dL' }],
  '2942-1': [{ label: 'nmol/L unit', loinc: '13967-5', longCommonName: 'Sex hormone binding globulin [Moles/volume] in Serum or Plasma', unit: 'nmol/L' }],
  '1989-3': [{ label: 'D2+D3 combined', loinc: '62292-8', longCommonName: '25-Hydroxyvitamin D3+25-Hydroxyvitamin D2 [Mass/volume] in Serum or Plasma', unit: 'ng/mL' }],
  '4548-4': [
    { label: 'by calculation', loinc: '17855-8', longCommonName: 'Hemoglobin A1c/Hemoglobin.total in Blood by calculation', unit: '%' },
    { label: 'IFCC unit', loinc: '59261-8', longCommonName: 'Hemoglobin A1c/Hemoglobin.total in Blood by IFCC protocol', unit: 'mmol/mol' },
  ],
  '2777-1': [{ label: 'whole blood', loinc: '2774-8', longCommonName: 'Phosphate [Mass/volume] in Blood', unit: 'mg/dL' }],
  '15081-3': [{ label: 'Mass/volume variant', loinc: '2842-3', longCommonName: 'Prolactin [Mass/volume] in Serum or Plasma', unit: 'ng/mL' }],
  '3094-0': [{ label: 'Urea', loinc: '3091-6', longCommonName: 'Urea [Mass/volume] in Serum or Plasma', unit: 'mg/dL' }],
  '1848-1': [{ label: 'nmol/L unit', loinc: '15057-3', longCommonName: 'Androstanolone (Dihydrotestosterone) [Moles/volume] in Serum or Plasma', unit: 'nmol/L' }],
  '2143-6': [{ label: 'nmol/L unit', loinc: '14675-3', longCommonName: 'Cortisol [Moles/volume] in Serum or Plasma', unit: 'nmol/L' }],
  '3024-7': [{ label: 'pmol/L unit', loinc: '14920-3', longCommonName: 'Thyroxine (T4) free [Moles/volume] in Serum or Plasma', unit: 'pmol/L' }],
};

// Reverse of ALSO_REFS: alias LOINC → the primary LOINC whose badge/row it
// folds into (so e.g. a result uploaded as 2986-8 shows on the T row).
export const ALIAS_TO_PRIMARY: Record<string, string> = Object.fromEntries(
  Object.entries(ALSO_REFS).flatMap(([primary, refs]) => refs.map((ref) => [ref.loinc, primary]))
);

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

/** All LOINCs an observation's row/badge answers for: its own plus its also-refs. */
export function testLoincs(test: Observation): string[] {
  return [test.loinc, ...(test.also?.map((ref) => ref.loinc) ?? [])];
}

// True when echoing `short` beside `full` would add nothing: the full name
// already contains it (ignoring case and punctuation, so "25OH" matches
// "(25-OH)"), or each word of the short label abbreviates a word of the full
// name in order ("Vit D" ⊂ "Vitamin D (25-OH)").
export function isEchoRedundant(full: string, short: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (norm(full).includes(norm(short))) return true;
  const fullWords = full.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const shortWords = short.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let i = 0;
  for (const w of shortWords) {
    while (i < fullWords.length && !fullWords[i]!.startsWith(w)) i++;
    if (i === fullWords.length) return false;
    i++;
  }
  return true;
}


/** The Monitoring Panels grid model: PANEL_DEFS resolved against the loaded catalog. */
export function buildConditions(
  panels: Panel[],
  analysesCatalog: Record<string, Analysis>
): { name: string; tests: Observation[] }[] {
  return PANEL_DEFS.map((def) => {
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
      const labelInfo = SHORT_LABELS[loinc];
      return {
        short: labelInfo?.short ?? analysis?.displayName ?? loinc,
        full: analysis?.displayName ?? loinc,
        longCommonName: analysis?.longCommonName ?? '',
        loinc,
        unit: labelInfo?.unit,
        also: ALSO_REFS[loinc],
      };
    });
    return { name: def.name, tests };
  });
}
