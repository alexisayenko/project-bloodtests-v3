import type { Result } from '../types';

/**
 * Client-side computed indices — ratios/estimates derived from other
 * observations, not reported directly by any lab. Ported from
 * project-bloodtests-v2's engine/src/indices/{definitions,build,free-testosterone}.ts
 * and engine/src/{flag,convert}.ts. Age/sex-dependent indices (eGFR x3, FIB-4)
 * are intentionally NOT ported -- v3 has no user profile to source age/sex from;
 * eGFR stays the lab-reported LOINC value it already was.
 */

export type Markers = Record<string, number | undefined>;

const has = (m: Markers, ...keys: string[]): boolean => keys.every((k) => m[k] != null);

/**
 * v2 marker short name -> candidate v3 LOINC codes, for every marker any ported
 * index needs. Some analytes are reported under different LOINCs across labs/eras
 * (same list as MedicalConditionsPage's ALSO_REFS) -- listed primary-first, tried
 * in order, first one with data on the draw's date wins.
 */
export const MARKER_LOINC: Record<string, string[]> = {
  TC: ['2093-3'],
  'HDL-C': ['2085-9'],
  'LDL-C': ['13457-7'],
  TRIG: ['2571-8'],
  ApoB: ['1884-6'],
  ApoA1: ['1869-7'],
  GLU: ['2339-0'],
  Insulin: ['20448-7'],
  T: ['14913-8', '2986-8'],
  SHBG: ['2942-1', '13967-5'],
  ALB: ['1751-7'],
  DHT: ['1848-1', '15057-3'],
  LH: ['10501-5'],
  E2: ['2243-4'],
  Cortisol: ['2143-6'],
  'DHEA-S': ['2191-5'],
  FT3: ['3051-0'],
  FT4: ['3024-7'],
  AST: ['1920-8'],
  ALT: ['1742-6'],
  Fe: ['2498-4'],
  TIBC: ['2500-7'],
};

// ---- unit conversion, ported verbatim from engine/src/convert.ts + build.ts's UNIT_CONVERSIONS ----

const cholMgdlToMmoll = (x: number) => x / 38.67;
const tgMgdlToMmoll = (x: number) => x / 88.57;
const glucoseMgdlToMmoll = (x: number) => x / 18.018;

const MGDL_TO_MMOLL: Record<string, (x: number) => number> = {
  TC: cholMgdlToMmoll,
  'HDL-C': cholMgdlToMmoll,
  'LDL-C': cholMgdlToMmoll,
  TRIG: tgMgdlToMmoll,
  GLU: glucoseMgdlToMmoll,
};

interface UnitConv {
  marker: string;
  from: string;
  to: string;
  conv: (x: number) => number;
}

// Testosterone MW 288.42 g/mol (see calculatedFreeTestosterone below) => 1 ng/dL = 0.03467 nmol/L.
const T_NGDL_TO_NMOLL_FACTOR = 0.03467;

const UNIT_CONVERSIONS: UnitConv[] = [
  { marker: 'FT3', from: 'pg/mL', to: 'pmol/L', conv: (x) => x * 1.536 },
  { marker: 'FT3', from: 'pmol/L', to: 'pg/mL', conv: (x) => x / 1.536 },
  { marker: 'FT4', from: 'ng/dL', to: 'pmol/L', conv: (x) => x * 12.87 },
  { marker: 'FT4', from: 'pmol/L', to: 'ng/dL', conv: (x) => x / 12.87 },
  // Testosterone: nmol/L (molar, e.g. LOINC 14913-8) <-> ng/dL (the mass unit
  // cft/tlh/te2/dhtt's formulas expect).
  { marker: 'T', from: 'nmol/L', to: 'ng/dL', conv: (x) => x / T_NGDL_TO_NMOLL_FACTOR },
  { marker: 'T', from: 'ng/dL', to: 'nmol/L', conv: (x) => x * T_NGDL_TO_NMOLL_FACTOR },
  // Testosterone: ng/mL (e.g. LOINC 2986-8) <-> ng/dL -- same mass unit, dL = 100 mL.
  { marker: 'T', from: 'ng/mL', to: 'ng/dL', conv: (x) => x * 100 },
  { marker: 'T', from: 'ng/dL', to: 'ng/mL', conv: (x) => x / 100 },
  // Testosterone: ng/mL <-> nmol/L directly (ng/mL -> ng/dL -> nmol/L combined).
  { marker: 'T', from: 'ng/mL', to: 'nmol/L', conv: (x) => x * 100 * T_NGDL_TO_NMOLL_FACTOR },
  { marker: 'T', from: 'nmol/L', to: 'ng/mL', conv: (x) => x / T_NGDL_TO_NMOLL_FACTOR / 100 },
  ...Object.entries(MGDL_TO_MMOLL).flatMap(([marker, f]): UnitConv[] => [
    { marker, from: 'mg/dL', to: 'mmol/L', conv: f },
    { marker, from: 'mmol/L', to: 'mg/dL', conv: (x) => x / f(1) },
  ]),
];

export function toUnit(value: number, marker: string, from: string | null | undefined, to: string): number {
  if (!from || from === to) return value;
  const rule = UNIT_CONVERSIONS.find((r) => r.marker === marker && r.from === from && r.to === to);
  return rule ? rule.conv(value) : value;
}

/**
 * The SI/US toggle only touches observations we have a verified conversion
 * factor for (the markers above with an entry in UNIT_CONVERSIONS) -- every
 * other observation keeps showing its as-reported value/unit unchanged rather
 * than an invented conversion.
 */
export const SI_US_UNIT: Record<string, { si: string; us: string }> = {
  TC: { si: 'mmol/L', us: 'mg/dL' },
  'HDL-C': { si: 'mmol/L', us: 'mg/dL' },
  'LDL-C': { si: 'mmol/L', us: 'mg/dL' },
  TRIG: { si: 'mmol/L', us: 'mg/dL' },
  GLU: { si: 'mmol/L', us: 'mg/dL' },
  T: { si: 'nmol/L', us: 'ng/dL' },
  FT3: { si: 'pmol/L', us: 'pg/mL' },
  FT4: { si: 'pmol/L', us: 'ng/dL' },
};

// ---- 3-zone coloring, ported verbatim from engine/src/flag.ts's `zone()` ----

export type Zone = 'ok' | 'warn' | 'bad';

export function zone(value: number, good: number, warn: number, hi = false): Zone {
  if (hi) {
    if (value >= good) return 'ok';
    if (value >= warn) return 'warn';
    return 'bad';
  }
  if (value < good) return 'ok';
  if (value < warn) return 'warn';
  return 'bad';
}

// ---- calculated free testosterone (Vermeulen equation), ported verbatim from
// engine/src/indices/free-testosterone.ts ----

const ALBUMIN_MW = 69000; // g/mol, Vermeulen/ISSAM calculator convention (not albumin's true MW)
const KA_ALBUMIN = 3.6e4; // L/mol, testosterone-albumin association constant
const KS_SHBG = 1e9; // L/mol, testosterone-SHBG association constant
const T_NGDL_TO_NMOLL = 0.03467; // testosterone MW 288.42 g/mol
const DEFAULT_ALBUMIN_GDL = 4.3;

function calculatedFreeTestosterone(totalT_ngdl: number, shbg_nmoll: number, albumin_gdl?: number): number {
  const T = totalT_ngdl * T_NGDL_TO_NMOLL * 1e-9; // ng/dL -> nmol/L -> mol/L
  const S = shbg_nmoll * 1e-9; // nmol/L -> mol/L
  const A = ((albumin_gdl ?? DEFAULT_ALBUMIN_GDL) * 10) / ALBUMIN_MW; // g/dL -> g/L -> mol/L
  const N = KA_ALBUMIN * A + 1;
  const a = N * KS_SHBG;
  const b = N + KS_SHBG * (S - T);
  const c = -T;
  const FT = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a); // mol/L
  return (FT / 1e-9 / T_NGDL_TO_NMOLL) * 10; // mol/L -> nmol/L -> ng/dL -> pg/mL
}

export interface IndexReference {
  organization: string;
  document: string;
  year?: number;
  url?: string;
  doi?: string | null;
  quote: string;
}

export interface IndexDef {
  key: string;
  name: string;
  nameCompact: string;
  /** Monitoring Panel names (MedicalConditionsPage's PANEL_DEFS) this index appears under. */
  panels: string[];
  formula: string;
  /** [good, warn] cut-points. */
  cut: [number, number];
  /** true = higher-is-better. */
  hi?: boolean;
  unit?: string;
  /** v2 marker short names -- keys into MARKER_LOINC. */
  needs: string[];
  inputUnits?: Partial<Record<string, string>>;
  level: 'consensus' | 'heuristic';
  meaning: string;
  consensus: string;
  evidenceLevel: string;
  references: IndexReference[];
  /** Set only when the lab can independently report this exact quantity. */
  loinc?: string;
  fn: (m: Markers) => number | null;
}

export const INDEX_DEFS: IndexDef[] = [
  {
    key: 'ka', name: 'Atherogenic coefficient', nameCompact: 'AC', panels: ['Cardiovascular Risk'],
    formula: '(TC − HDL) / HDL', cut: [3, 4], needs: ['TC', 'HDL-C'], level: 'heuristic',
    meaning: 'Share of atherogenic cholesterol relative to protective HDL. Higher = more atherogenic blood. Rough guide: <3 good, 3–4 borderline, >4 high.',
    consensus: 'Common in post-Soviet labs; in international guidelines superseded by ApoB and direct ratios. Fine as a rough orientation.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "American Heart Association (Framingham Heart Study)", document: "Prediction of Coronary Heart Disease Using Risk Factor Categories (Wilson PWF et al.)", year: 1998, url: "https://www.ahajournals.org/doi/10.1161/01.CIR.97.18.1837", doi: "10.1161/01.CIR.97.18.1837", quote: "AC = (TC−HDL)/HDL is algebraically TC/HDL − 1, so it carries the same information as the Framingham total/HDL ratio; the cut-points here are post-Soviet (Klimov) orientation values with no international guideline validation." },
    ],
    fn: (m) => (has(m, 'TC', 'HDL-C') ? (m['TC']! - m['HDL-C']!) / m['HDL-C']! : null),
  },
  {
    key: 'tchdl', name: 'TC / HDL ratio', nameCompact: 'TC/HDL', panels: ['Cardiovascular Risk'],
    formula: 'TC / HDL', cut: [3.5, 5], needs: ['TC', 'HDL-C'], level: 'consensus', loinc: '9830-1',
    meaning: 'Total cholesterol per unit of protective HDL. Simple, robust cardiovascular-risk marker. Target usually <3.5–4.',
    consensus: 'Well-established CV-risk marker, used in risk calculators (e.g. Framingham). Good evidence base.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "American Heart Association (Framingham Heart Study)", document: "Prediction of Coronary Heart Disease Using Risk Factor Categories (Wilson PWF et al.)", year: 1998, url: "https://www.ahajournals.org/doi/10.1161/01.CIR.97.18.1837", doi: "10.1161/01.CIR.97.18.1837", quote: "Total cholesterol and HDL-cholesterol categories are used to predict coronary heart disease risk; the total/HDL ratio is a long-standing Framingham risk marker." },
    ],
    fn: (m) => (has(m, 'TC', 'HDL-C') ? m['TC']! / m['HDL-C']! : null),
  },
  {
    key: 'ldlhdl', name: 'LDL / HDL ratio', nameCompact: 'LDL/HDL', panels: ['Cardiovascular Risk'],
    formula: 'LDL / HDL', cut: [2, 3.5], needs: ['LDL-C', 'HDL-C'], level: 'heuristic', loinc: '11054-4',
    meaning: 'Direct ratio of atherogenic LDL to protective HDL. More LDL-sensitive than TC/HDL. Target <2–3.',
    consensus: 'Long used and intuitive, but current guidance considers ApoB / non-HDL more accurate.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "European Society of Cardiology / European Atherosclerosis Society", document: "2019 ESC/EAS Guidelines for the management of dyslipidaemias (Mach F et al.)", year: 2020, url: "https://academic.oup.com/eurheartj/article/41/1/111/5556353", doi: "10.1093/eurheartj/ehz455", quote: "Guidelines set treatment targets for LDL-C, non-HDL-C and ApoB; the LDL/HDL ratio has no formal guideline target, so the cut-points here are orientation only." },
    ],
    fn: (m) => (has(m, 'LDL-C', 'HDL-C') ? m['LDL-C']! / m['HDL-C']! : null),
  },
  {
    key: 'aip', name: 'AIP (atherogenic index of plasma)', nameCompact: 'AIP', panels: ['Insulin Resistance', 'Cardiovascular Risk'],
    formula: 'log₁₀(TG / HDL), molar', cut: [0.11, 0.21], needs: ['TRIG', 'HDL-C'],
    inputUnits: { TRIG: 'mmol/L', 'HDL-C': 'mmol/L' }, level: 'consensus',
    meaning: 'Reflects LDL particle size and insulin resistance. Scale: <0.11 low risk, 0.11–0.21 medium, >0.21 high.',
    consensus: 'Growing evidence as a CV-risk predictor, especially with high triglycerides / metabolic syndrome.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "Clinical Biochemistry (Dobiásová M, Frohlich J)", document: "The plasma parameter log(TG/HDL-C) as an atherogenic index", year: 2001, url: "https://pubmed.ncbi.nlm.nih.gov/11738396/", doi: "10.1016/S0009-9120(01)00263-6", quote: "Introduces AIP = log10(TG/HDL-C) in molar units, correlating with LDL particle size and cholesterol esterification rate; the <0.11 / 0.11–0.21 / >0.21 risk bands originate here." },
    ],
    fn: (m) => (has(m, 'TRIG', 'HDL-C') ? Math.log10(m['TRIG']! / m['HDL-C']!) : null),
  },
  {
    key: 'nonhdl', name: 'Non-HDL cholesterol', nameCompact: 'Non HDL', panels: ['Cardiovascular Risk'],
    formula: 'TC − HDL (mg/dL)', cut: [130, 160], unit: 'mg/dL', needs: ['TC', 'HDL-C'],
    inputUnits: { TC: 'mg/dL', 'HDL-C': 'mg/dL' }, level: 'consensus', loinc: '43396-1',
    meaning: 'All atherogenic cholesterol (LDL + VLDL + remnants). Reflects risk better than LDL alone, especially with high TG. Target <130 mg/dL (high risk <100).',
    consensus: 'Recommended by ESC/AHA guidelines as a secondary treatment target; more reliable than isolated LDL.',
    evidenceLevel: 'guideline',
    references: [
      { organization: "European Society of Cardiology / European Atherosclerosis Society", document: "2019 ESC/EAS Guidelines for the management of dyslipidaemias (Mach F et al.)", year: 2020, url: "https://academic.oup.com/eurheartj/article/41/1/111/5556353", doi: "10.1093/eurheartj/ehz455", quote: "Non-HDL-C is recommended as a secondary treatment target, with goals (e.g. <2.6 mmol/L ≈ 100 mg/dL in high risk) set 30 mg/dL above the corresponding LDL-C goal." },
      { organization: "National Cholesterol Education Program (NCEP) Expert Panel", document: "Third Report (ATP III), JAMA", year: 2001, url: "https://pubmed.ncbi.nlm.nih.gov/11368702/", doi: "10.1001/jama.285.19.2486", quote: "Non-HDL-C goal = LDL-C goal + 30 mg/dL, giving the <130 mg/dL (moderate) / <100 mg/dL (high-risk) thresholds used here." },
    ],
    fn: (m) => (has(m, 'TC', 'HDL-C') ? m['TC']! - m['HDL-C']! : null),
  },
  {
    key: 'remnant', name: 'Remnant cholesterol', nameCompact: 'Remnant-C', panels: ['Cardiovascular Risk'],
    formula: 'TC − HDL − LDL (mg/dL)', cut: [24, 30], unit: 'mg/dL', needs: ['TC', 'HDL-C', 'LDL-C'],
    inputUnits: { TC: 'mg/dL', 'HDL-C': 'mg/dL', 'LDL-C': 'mg/dL' }, level: 'consensus',
    meaning: 'Cholesterol in triglyceride-rich lipoproteins (VLDL and remnants). Independent CV-risk and vascular-inflammation factor. Target <24 mg/dL (~0.6 mmol/L).',
    consensus: 'Accumulating evidence as a causal driver of atherosclerosis; increasingly used.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "Journal of the American College of Cardiology (Varbo A, Nordestgaard BG et al.)", document: "Remnant Cholesterol as a Causal Risk Factor for Ischemic Heart Disease", year: 2013, url: "https://pubmed.ncbi.nlm.nih.gov/23265341/", doi: "10.1016/j.jacc.2012.08.1026", quote: "Mendelian-randomization evidence that elevated remnant cholesterol (TC − HDL-C − LDL-C) is causally associated with ischemic heart disease; supports the ~0.6 mmol/L (~24 mg/dL) orientation threshold." },
    ],
    fn: (m) => (has(m, 'TC', 'HDL-C', 'LDL-C') ? m['TC']! - m['HDL-C']! - m['LDL-C']! : null),
  },
  {
    key: 'vldl', name: 'VLDL cholesterol', nameCompact: 'VLDL', panels: ['Cardiovascular Risk'],
    formula: 'TG / 5 (mg/dL)', cut: [30, 40], unit: 'mg/dL', needs: ['TRIG'],
    inputUnits: { TRIG: 'mg/dL' }, level: 'heuristic', loinc: '13458-5',
    meaning: 'Cholesterol carried by triglyceride-rich VLDL (\'pre-beta\' lipoprotein), estimated as triglycerides ÷ 5 (Friedewald — valid when TG <400 mg/dL). Tracks triglyceride load; overlaps with the Remnant-cholesterol index (VLDL is the bulk of remnants). Guide: <30 normal · 30–40 borderline · >40 high.',
    consensus: 'Standard Friedewald estimate; a rough surrogate, not a directly measured fraction. Remnant-C is the more modern read of the same triglyceride-rich pool.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Clinical Chemistry (Friedewald WT, Levy RI, Fredrickson DS)", document: "Estimation of the concentration of low-density lipoprotein cholesterol in plasma, without use of the preparative ultracentrifuge", year: 1972, url: "https://pubmed.ncbi.nlm.nih.gov/4337382/", doi: "10.1093/clinchem/18.6.499", quote: "VLDL-C is estimated as triglycerides/5 (mg/dL), valid when TG <400 mg/dL. The <30/30–40/>40 mg/dL bands are lab-orientation values, not a guideline threshold." },
    ],
    fn: (m) => (has(m, 'TRIG') ? m['TRIG']! / 5 : null),
  },
  {
    key: 'apobapoa', name: 'ApoB / ApoA1', nameCompact: 'ApoB/ApoA', panels: ['Cardiovascular Risk'],
    formula: 'ApoB / ApoA1', cut: [0.7, 0.9], needs: ['ApoB', 'ApoA1'], level: 'consensus', loinc: '1874-7',
    meaning: 'Atherogenic particles (ApoB) per protective particle (ApoA1) — essentially \'bad\' particles per \'good\'. One of the strongest lipid predictors of MI. Men: <0.7 low, 0.7–0.9 moderate, >0.9 high.',
    consensus: 'Strong predictor in large studies (INTERHEART). Needs ApoB and ApoA1 from the same draw — not yet measured.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "The Lancet (McQueen MJ et al., INTERHEART study)", document: "Lipids, lipoproteins, and apolipoproteins as risk markers of myocardial infarction in 52 countries (INTERHEART)", year: 2008, url: "https://pubmed.ncbi.nlm.nih.gov/18640459/", doi: "10.1016/S0140-6736(08)61076-4", quote: "The ApoB/ApoA1 ratio was the strongest lipid predictor of myocardial infarction across all regions, sexes and ages." },
      { organization: "The Lancet (Yusuf S et al., INTERHEART study)", document: "Effect of potentially modifiable risk factors associated with myocardial infarction in 52 countries", year: 2004, url: "https://pubmed.ncbi.nlm.nih.gov/15364185/", doi: "10.1016/S0140-6736(04)17018-9", quote: "Raised ApoB/ApoA1 ratio: odds ratio 3.25 (top vs lowest quintile), among the largest population-attributable risks for MI." },
    ],
    fn: (m) => (has(m, 'ApoB', 'ApoA1') ? m['ApoB']! / m['ApoA1']! : null),
  },
  {
    key: 'tyg', name: 'TyG index', nameCompact: 'TyG', panels: ['Insulin Resistance'],
    formula: 'ln(TG[mg/dL] × glucose[mg/dL] / 2)', cut: [8.5, 9], needs: ['TRIG', 'GLU'],
    inputUnits: { TRIG: 'mg/dL', GLU: 'mg/dL' }, level: 'consensus',
    meaning: 'Surrogate of insulin resistance from triglycerides and glucose — no insulin needed. Guide: <8.5 normal, >9 marked IR.',
    consensus: 'Well-validated IR / metabolic-risk marker; convenient (no insulin assay). Needs fasting TG and glucose from one draw.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "Metabolic Syndrome and Related Disorders (Simental-Mendía LE, Rodríguez-Morán M, Guerrero-Romero F)", document: "The Product of Fasting Glucose and Triglycerides as Surrogate for Identifying Insulin Resistance in Apparently Healthy Subjects", year: 2008, url: "https://pubmed.ncbi.nlm.nih.gov/19067533/", doi: "10.1089/met.2008.0034", quote: "Defines TyG = Ln[fasting TG(mg/dL) × fasting glucose(mg/dL)/2] as a surrogate of insulin resistance validated against HOMA-IR; the ~8.5–9 bands derive from this and follow-on clamp-validation work." },
    ],
    fn: (m) => (has(m, 'TRIG', 'GLU') ? Math.log((m['TRIG']! * m['GLU']!) / 2) : null),
  },
  {
    key: 'gi', name: 'Glucose / insulin ratio', nameCompact: 'Glu/Insulin', panels: ['Insulin Resistance'],
    formula: 'glucose(mg/dL) / insulin(µIU/mL)', cut: [7, 4.5], hi: true, needs: ['GLU', 'Insulin'],
    inputUnits: { GLU: 'mg/dL' }, level: 'heuristic', loinc: '62418-9',
    meaning: 'An older fasting insulin-resistance surrogate: glucose ÷ insulin. Higher = more insulin-sensitive; a low ratio means high fasting insulin (insulin resistance). Cutoffs vary widely by population and assay — your lab printed >10 as normal, while the FGIR literature often uses <4.5 for IR — so read it as orientation only. Guide here: >7 sensitive · 4.5–7 borderline · <4.5 resistant.',
    consensus: 'Crude, non-standardized IR proxy, superseded by HOMA-IR (built from the same two values). Kept mainly because the lab reported it; prefer HOMA-IR.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Journal of Clinical Endocrinology & Metabolism (Legro RS, Finegood D, Dunaif A)", document: "A fasting glucose to insulin ratio is a useful measure of insulin sensitivity in women with polycystic ovary syndrome", year: 1998, url: "https://pubmed.ncbi.nlm.nih.gov/9709933/", doi: "10.1210/jcem.83.8.5054", quote: "Fasting glucose/insulin ratio <4.5 indicates insulin resistance — a threshold derived in PCOS women, population- and assay-specific, so the bands here are orientation only." },
    ],
    fn: (m) => (has(m, 'GLU', 'Insulin') ? m['GLU']! / m['Insulin']! : null),
  },
  {
    key: 'homair', name: 'HOMA-IR', nameCompact: 'HOMA-IR', panels: ['Insulin Resistance', 'Pancreatic Function'],
    formula: 'glucose(mmol/L) × insulin(µIU/mL) / 22.5', cut: [2, 2.9], needs: ['GLU', 'Insulin'],
    inputUnits: { GLU: 'mmol/L' }, level: 'consensus',
    meaning: 'Fasting insulin-resistance estimate. Guide: <2 normal · 2–2.9 borderline / early insulin resistance · ≥2.9 insulin resistance.',
    consensus: 'Standard IR screening index. Requires fasting glucose AND insulin from one draw — insulin not yet measured.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "Diabetologia (Matthews DR et al.)", document: "Homeostasis model assessment: insulin resistance and beta-cell function from fasting plasma glucose and insulin concentrations in man", year: 1985, url: "https://pubmed.ncbi.nlm.nih.gov/3899825/", doi: "10.1007/BF00280883", quote: "HOMA-IR = fasting glucose(mmol/L) × fasting insulin(µU/mL) / 22.5. Population-specific cut-points (~2–2.9) are commonly used but not a single fixed guideline threshold." },
    ],
    fn: (m) => (has(m, 'GLU', 'Insulin') ? (m['GLU']! * m['Insulin']!) / 22.5 : null),
  },
  {
    key: 'homab', name: 'HOMA-%B (beta-cell function)', nameCompact: 'HOMA-%B', panels: ['Pancreatic Function', 'Insulin Resistance'],
    formula: '20 × insulin(µIU/mL) / (glucose(mmol/L) − 3.5)', cut: [80, 50], hi: true, unit: '%', needs: ['GLU', 'Insulin'],
    inputUnits: { GLU: 'mmol/L' }, level: 'heuristic',
    meaning: 'Estimates how well the pancreas\'s beta cells are still producing insulin, from the SAME fasting glucose + insulin pair as HOMA-IR (one draw, both fasting). Reference is ~100% = normal beta-cell function; lower means the beta cells are no longer keeping up. It must be read NEXT TO HOMA-IR, never alone: the two answer different halves of one question — HOMA-IR says how resistant the tissues are, %B says whether the pancreas can still compensate. A calm HOMA-IR with a low %B is a real pattern: no insulin resistance, but the beta cells are under-delivering, and glucose creeps up anyway. Guide: >80% good · 50–80% borderline · <50% low — orientation only, HOMA-%B has no agreed cut-points. And one draw is one point, not a trend.',
    consensus: 'Deliberately graded HEURISTIC, not consensus, for two honest reasons. (1) HOMA1\'s linear approximation is imprecise — the original paper reports a coefficient of variation around 32%; the non-linear HOMA2 model is the better estimator and this engine does not implement it. (2) The HOMA authors explicitly list measuring beta-cell function in isolation among the model\'s inappropriate uses; %B is meaningful only alongside HOMA-IR, which is why it is shipped on the same lenses and never on its own. Requires fasting glucose AND insulin from ONE draw — computed only where both exist on the same date, never paired across dates. Undefined when fasting glucose ≤ 3.5 mmol/L (the formula\'s denominator), in which case no value is produced.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Diabetologia (Matthews DR et al.)", document: "Homeostasis model assessment: insulin resistance and beta-cell function from fasting plasma glucose and insulin concentrations in man", year: 1985, url: "https://pubmed.ncbi.nlm.nih.gov/3899825/", doi: "10.1007/BF00280883", quote: "Source of the HOMA1 %B approximation, %B = 20 × insulin(µU/mL) / (glucose(mmol/L) − 3.5), and of the ~32% coefficient of variation that makes a single estimate imprecise." },
      { organization: "Diabetes Care (Wallace TM, Levy JC, Matthews DR)", document: "Use and abuse of HOMA modeling", year: 2004, url: "https://pubmed.ncbi.nlm.nih.gov/15161807/", doi: "10.2337/diacare.27.6.1487", quote: "The HOMA authors' own guidance on appropriate use: HOMA2 is preferred over the HOMA1 linear approximation, and measuring beta-cell function in isolation is named as an inappropriate use of the model — %B is to be read together with HOMA-IR." },
    ],
    fn: (m) => (has(m, 'GLU', 'Insulin') && m['GLU']! > 3.5 ? (20 * m['Insulin']!) / (m['GLU']! - 3.5) : null),
  },
  {
    key: 'cft', name: 'Free testosterone (calculated)', nameCompact: 'cFT', panels: ['Hypogonadism'],
    formula: 'free T = (−b + √(b²−4ac)) / 2a\na = N·Ks\nb = N + Ks(SHBG−T)\nc = −T\nN = 1 + Ka·albumin\n(Vermeulen equation, all in mol/L)',
    cut: [100, 65], unit: 'pg/mL', hi: true, needs: ['T', 'SHBG'],
    inputUnits: { T: 'ng/dL', SHBG: 'nmol/L' }, level: 'consensus', loinc: '103227-5',
    meaning: 'Bioavailable testosterone estimated from total T, SHBG and albumin (Vermeulen equation), in pg/mL. Assay-independent — compare it with the measured Free Testosterone row, whose direct immunoassay is unreliable and uses incompatible reference ranges across labs. Higher is better; guide: >100 good · 65–100 low-normal · <65 low (~6.5 ng/dL floor). Albumin defaults to 4.3 g/dL when not measured. The equation solves the binding equilibrium of testosterone to SHBG (high affinity, Ks≈1×10⁹ L/mol) and albumin (low affinity, Ka≈3.6×10⁴ L/mol) as a quadratic: free T = [−b+√(b²−4ac)]/2a, with a=N·Ks, b=N+Ks(SHBG−T), c=−T and N=1+Ka·albumin (all in mol/L).',
    consensus: 'Calculated free T (Vermeulen) is the method recommended by the Endocrine Society when free T is needed; direct analog free-T immunoassays are discouraged — they systematically under-read and are lab-specific (which is why the measured row can differ several-fold and only agrees on some assays). Sanity check: free T should be ~2% of total. A measured 23.6 pg/mL against a total T of 888 ng/dL is 0.27% — physiologically impossible; the calculated ~2.4% is the right order. So when the two rows disagree, trust the calculated one.',
    evidenceLevel: 'guideline',
    references: [
      { organization: "Journal of Clinical Endocrinology & Metabolism (Vermeulen A, Verdonck L, Kaufman JM)", document: "A critical evaluation of simple methods for the estimation of free testosterone in serum", year: 1999, url: "https://pubmed.ncbi.nlm.nih.gov/10523012/", doi: "10.1210/jcem.84.10.6079", quote: "Derives the equilibrium-binding equation (SHBG Ka≈1×10⁹, albumin Ka≈3.6×10⁴ L/mol) used here to compute free testosterone from total T, SHBG and albumin." },
      { organization: "Endocrine Society (Bhasin S et al.)", document: "Testosterone Therapy in Men With Hypogonadism: An Endocrine Society Clinical Practice Guideline, JCEM", year: 2018, url: "https://pubmed.ncbi.nlm.nih.gov/29562364/", doi: "10.1210/jc.2018-00229", quote: "When free testosterone is needed, measurement by equilibrium dialysis or estimation by accurate calculation is recommended; direct analog free-T immunoassays are not recommended." },
    ],
    fn: (m) => (m['T'] != null && m['SHBG'] != null ? calculatedFreeTestosterone(m['T']!, m['SHBG']!, m['ALB']) : null),
  },
  {
    key: 'tlh', name: 'T / LH ratio', nameCompact: 'T/LH', panels: ['Hypogonadism'],
    formula: 'T(ng/dL) / LH(mIU/mL)', cut: [100, 50], hi: true, needs: ['T', 'LH'],
    inputUnits: { T: 'ng/dL' }, level: 'heuristic',
    meaning: 'Leydig-cell function — testosterone output per unit of pituitary LH drive. A high ratio means the testes respond well to LH; a low ratio (low T despite high LH) points to primary testicular failure, whereas low T with low/normal LH points to a central (secondary) cause. No validated cutoff — read it alongside the absolute LH value. The bands here (>100 · 50–100 · <50) are orientation only.',
    consensus: 'Used in andrology research to characterise where a problem sits (testes vs pituitary); not a standardised diagnostic with fixed thresholds.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Frontiers in Endocrinology", document: "Late-Onset Hypogonadism as Primary Testicular Failure (compensated Leydig-cell failure)", year: 2019, url: "https://www.frontiersin.org/articles/10.3389/fendo.2019.00372/full", doi: "10.3389/fendo.2019.00372", quote: "Compensated Leydig-cell failure is characterised by a distorted LH-to-testosterone relationship (low T output per unit LH drive); no validated numeric T/LH cutoff exists, so the bands here are orientation only." },
    ],
    fn: (m) => (has(m, 'T', 'LH') ? m['T']! / m['LH']! : null),
  },
  {
    key: 'te2', name: 'T / E2 ratio', nameCompact: 'T/E2', panels: ['Hypogonadism'],
    formula: 'T(ng/dL) / E2(pg/mL)', cut: [15, 10], hi: true, needs: ['T', 'E2'],
    inputUnits: { T: 'ng/dL' }, level: 'heuristic',
    meaning: 'Aromatization balance — testosterone relative to the estradiol aromatized from it. A low ratio (<10) suggests relatively high estrogen conversion; mid-teens and up is usually comfortable. It cuts both ways, though: a very high ratio can mean estradiol is too low (E2 is needed for bone, libido and mood). Guide: >15 good · 10–15 borderline · <10 high relative estrogen.',
    consensus: 'Popular in men\'s-health / andrology practice; evidence is moderate and there is no formal guideline cutoff.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "The World Journal of Men's Health", document: "A Review on Testosterone:Estradiol Ratio — Does It Matter, How Do You Measure It, and Can You Optimize It?", year: 2024, url: "https://wjmh.org/DOIx.php?id=10.5534/wjmh.240029", doi: "10.5534/wjmh.240029", quote: "Reviews the T:E2 ratio (T ng/dL ÷ E2 pg/mL); a range of roughly 10–30 is discussed as potentially favourable, but there is no validated diagnostic cutoff — the bands here are orientation only." },
    ],
    fn: (m) => (has(m, 'T', 'E2') ? m['T']! / m['E2']! : null),
  },
  {
    key: 'dhtt', name: 'DHT / T ratio (5α-reductase)', nameCompact: 'DHT/T', panels: ['Hypogonadism'],
    formula: 'DHT / T × 100, %', cut: [12, 18], unit: '%', needs: ['DHT', 'T'],
    inputUnits: { T: 'ng/dL' }, level: 'heuristic',
    meaning: 'How much testosterone you convert to the more potent DHT via 5α-reductase, as a percent. Higher = more androgenic signalling in skin, scalp and prostate (relevant to hair loss, acne, BPH). It is contextual, not simply good/bad: a low ratio is expected on a 5α-reductase inhibitor (finasteride/dutasteride). Rough orientation: <12% typical · 12–18% high-normal · >18% high conversion. No validated cutoff.',
    consensus: 'Used to gauge 5α-reductase activity and to monitor 5α-reductase inhibitors; no standardised diagnostic threshold.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Journal of Clinical Endocrinology & Metabolism (Dallob AL et al.)", document: "The effect of finasteride, a 5α-reductase inhibitor, on scalp skin testosterone and dihydrotestosterone concentrations in patients with male pattern baldness", year: 1994, url: "https://pubmed.ncbi.nlm.nih.gov/8077349/", doi: "10.1210/jcem.79.3.8077349", quote: "The DHT/T ratio indexes 5α-reductase activity (T→DHT conversion); it is contextual — expected low on finasteride/dutasteride — and has no standardised diagnostic threshold, so the %-bands here are orientation only." },
    ],
    // /10 aligns DHT (pg/mL) to T's unit (ng/dL): 1 ng/dL = 10 pg/mL.
    fn: (m) => (has(m, 'DHT', 'T') ? (m['DHT']! / 10 / m['T']!) * 100 : null),
  },
  {
    key: 'cortdhea', name: 'Cortisol / DHEA-S ratio', nameCompact: 'Cort/DHEA', panels: ['Adrenal'],
    formula: 'Cortisol / DHEA-S (molar, both nmol/L)', cut: [0.1, 0.2], needs: ['Cortisol', 'DHEA-S'], level: 'heuristic',
    meaning: 'Balance between the catabolic stress hormone (cortisol) and the anabolic adrenal androgen reserve (DHEA-S), as a molar ratio with both in the same unit (nmol/L). Healthy adults sit around 0.03–0.10; a high ratio (high cortisol, low DHEA-S) is read as a chronic-stress / catabolic pattern. Guide (orientation only): <0.1 balanced · 0.1–0.2 borderline · >0.2 catabolic. Needs both from the same draw — you have plenty of cortisol but only one DHEA-S, and never together, so order them in one fasting morning draw.',
    consensus: 'Popular in functional / integrative medicine; weak support in conventional endocrinology and no agreed cutoff — treat as exploratory, not diagnostic.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "European Journal of Endocrinology (Phillips AC, Carroll D, Gale CR, Lord JM, Arlt W, Batty GD)", document: "Cortisol, DHEAS, their ratio and the metabolic syndrome: evidence from the Vietnam Experience Study", year: 2010, url: "https://pubmed.ncbi.nlm.nih.gov/20164211/", doi: "10.1530/EJE-09-1078", quote: "A higher cortisol:DHEAS ratio was associated with greater metabolic-syndrome risk; the ratio is a research/functional-medicine marker of catabolic-anabolic balance with no agreed diagnostic cutoff — bands here are orientation only." },
    ],
    // Both sides converted to nmol/L: cortisol µg/dL x27.59 (MW 362.46); DHEA-S µg/dL x27.14 (MW 368.5).
    fn: (m) => (has(m, 'Cortisol', 'DHEA-S') ? (m['Cortisol']! * 27.59) / (m['DHEA-S']! * 27.14) : null),
  },
  {
    key: 'ft3ft4', name: 'FT3 / FT4 ratio', nameCompact: 'FT3/FT4', panels: ['Hypothyroidism'],
    formula: 'FT3 / FT4 (molar)', cut: [0.3, 0.2], hi: true, needs: ['FT3', 'FT4'],
    inputUnits: { FT3: 'pmol/L', FT4: 'pmol/L' }, level: 'heuristic',
    meaning: 'Peripheral T4→T3 conversion (deiodinase activity), using the free hormones so it\'s independent of binding-protein swings. A low ratio means poor conversion — seen in low-T3 / euthyroid-sick syndrome, chronic stress, illness, low selenium or caloric restriction. Guide: >0.30 good · 0.20–0.30 low-normal · <0.20 poor conversion.',
    consensus: 'Used as an orientation for conversion problems; no formal diagnostic cutoff. Free-hormone ratio is preferred over total T3/T4 (which are distorted by binding globulin).',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Frontiers in Endocrinology", document: "Association between peripheral thyroid sensitivity defined by the FT3/FT4 ratio and adverse outcomes", year: 2025, url: "https://www.frontiersin.org/journals/endocrinology/articles/10.3389/fendo.2025.1652749/full", doi: "10.3389/fendo.2025.1652749", quote: "The FT3/FT4 ratio is a surrogate of peripheral T4→T3 deiodinase conversion; a low ratio marks impaired conversion (e.g. low-T3/euthyroid-sick states) but there is no formal diagnostic cutoff — the bands here are orientation only." },
    ],
    fn: (m) => (has(m, 'FT3', 'FT4') ? m['FT3']! / m['FT4']! : null),
  },
  {
    key: 'deritis', name: 'De Ritis ratio (AST/ALT)', nameCompact: 'De Ritis', panels: ['Fatty Liver'],
    formula: 'AST / ALT', cut: [1.3, 2], needs: ['AST', 'ALT'], level: 'consensus', loinc: '1916-6',
    meaning: 'Pattern of liver injury. <1 typical of fatty liver; >1 alcoholic/cirrhotic or muscle source; >2 especially concerning.',
    consensus: 'Classic hepatology index with a long track record.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "The Clinical Biochemist Reviews (Botros M, Sikaris KA)", document: "The De Ritis Ratio: The Test of Time", year: 2013, url: "https://pubmed.ncbi.nlm.nih.gov/24353357/", doi: null, quote: "Reviews the AST/ALT (De Ritis) ratio: the differing half-lives of AST (~18 h) and ALT (~36 h) make the ratio reflect the type and severity of liver injury; a ratio >1 (and especially >2) points to alcoholic/cirrhotic or extrahepatic sources." },
    ],
    fn: (m) => (has(m, 'AST', 'ALT') ? m['AST']! / m['ALT']! : null),
  },
  {
    key: 'tsat', name: 'Transferrin saturation', nameCompact: 'TSAT', panels: ['Anemia'],
    formula: 'serum iron / TIBC × 100, %', cut: [20, 15], unit: '%', hi: true, needs: ['Fe', 'TIBC'],
    level: 'consensus', loinc: '2502-3',
    meaning: 'How full the iron-transport protein (transferrin) is running. Low is the iron-deficiency signal: 20–45% normal · 15–20 low · <15 clear deficiency. More dynamic than ferritin, so they\'re read together. Note the other end — a HIGH saturation (>45%) means iron overload / hemochromatosis (flagged via ferritin on the Hypogonadism lens).',
    consensus: 'Standard part of the iron panel; interpreted alongside ferritin.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "American College of Gastroenterology (Kowdley KV, Brown KE, Ahn J, Sundaram V)", document: "ACG Clinical Guideline: Hereditary Hemochromatosis, Am J Gastroenterol", year: 2019, url: "https://pubmed.ncbi.nlm.nih.gov/31335359/", doi: "10.14309/ajg.0000000000000315", quote: "A fasting transferrin saturation ≥45% is the recommended screening threshold for iron overload; conversely a low saturation (<~20%, with <15% clear) signals iron deficiency — the thresholds used here." },
    ],
    fn: (m) => (has(m, 'Fe', 'TIBC') ? (m['Fe']! / m['TIBC']!) * 100 : null),
  },
];

/** First of a marker's candidate LOINCs that has a value on this draw. */
function findResult(short: string, resultsByLoinc: Record<string, Result>): Result | undefined {
  for (const loinc of MARKER_LOINC[short] ?? []) {
    const r = resultsByLoinc[loinc];
    if (r?.value != null) return r;
  }
  return undefined;
}

/** One draw's observations, converted to the units each index's fn expects. */
export function markersForIndex(def: IndexDef, resultsByLoinc: Record<string, Result>): Markers {
  const m: Markers = {};
  for (const short of def.needs) {
    const r = findResult(short, resultsByLoinc);
    if (r?.value == null) continue;
    const target = def.inputUnits?.[short];
    m[short] = target ? toUnit(r.value, short, r.unit, target) : r.value;
  }
  if (def.key === 'cft') {
    const alb = findResult('ALB', resultsByLoinc);
    if (alb?.value != null) m['ALB'] = alb.value;
  }
  return m;
}

export function computeIndex(def: IndexDef, resultsByLoinc: Record<string, Result>): number | null {
  const v = def.fn(markersForIndex(def, resultsByLoinc));
  if (v == null || !Number.isFinite(v)) return null;
  // Quantize to 2dp before display formatting -- matches v2's historical display
  // (e.g. AIP 0.4475 -> 0.45 -> "0.45", not fmtNum's raw "0.448").
  return Math.round(v * 100) / 100;
}
