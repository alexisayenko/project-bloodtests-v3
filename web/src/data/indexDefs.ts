import { molarPerMass, type IndexDef, type Markers } from './computedIndices';

/**
 * The clinical definitions the index engine in `computedIndices.ts` runs:
 * formulas, cut-points, prose and cited sources. Imports the engine's types
 * one-directionally -- the engine never reaches back for the definitions,
 * every function there takes an `IndexDef` as an argument.
 */

const has = (m: Markers, ...keys: string[]): boolean => keys.every((k) => m[k] != null);

const T_NGDL_TO_NMOLL = molarPerMass('testosterone');
// Used inside the cortisol/DHEA-S index's fn, which needs both sides in nmol/L.
const CORTISOL_UGDL_TO_NMOLL = molarPerMass('cortisol');
const DHEAS_UGDL_TO_NMOLL = molarPerMass('dheas');

// ---- calculated free testosterone (Vermeulen equation), ported verbatim from
// engine/src/indices/free-testosterone.ts ----

const ALBUMIN_MW = 69000; // g/mol, Vermeulen/ISSAM calculator convention (not albumin's true MW)
const KA_ALBUMIN = 3.6e4; // L/mol, testosterone-albumin association constant
const KS_SHBG = 1e9; // L/mol, testosterone-SHBG association constant
export const DEFAULT_ALBUMIN_GDL = 4.3;

const albuminMolL = (albumin_gdl?: number) => ((albumin_gdl ?? DEFAULT_ALBUMIN_GDL) * 10) / ALBUMIN_MW; // g/dL -> g/L -> mol/L

/** Vermeulen's quadratic: free T in mol/L from total T, SHBG and albumin, all in mol/L. */
function vermeulenFreeT(T: number, S: number, A: number): number {
  const N = KA_ALBUMIN * A + 1;
  const a = N * KS_SHBG;
  const b = N + KS_SHBG * (S - T);
  const c = -T;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

function calculatedFreeTestosterone(totalT_ngdl: number, shbg_nmoll: number, albumin_gdl?: number): number {
  const T = totalT_ngdl * T_NGDL_TO_NMOLL * 1e-9; // ng/dL -> nmol/L -> mol/L
  const FT = vermeulenFreeT(T, shbg_nmoll * 1e-9, albuminMolL(albumin_gdl));
  return (FT / 1e-9 / T_NGDL_TO_NMOLL) * 10; // mol/L -> nmol/L -> ng/dL -> pg/mL
}

// Mayo Clinic Laboratories' bioavailable testosterone reference limits (test
// TTBS), ng/dL: the men's lower limits for ages 20-29 and 60-69, the women's
// (20-50, non-oophorectomized) upper limits on and off oral estrogen.
const BIOT_NGDL = { male20s: 83, male60s: 40, femaleOralEstrogen: 4, female: 10 } as const;
const biotNmol = (ngdl: number) => ngdl * T_NGDL_TO_NMOLL;
const biotShown = (ngdl: number) => Number(biotNmol(ngdl).toPrecision(3));

/** Free plus albumin-bound testosterone, nmol/L: free T × (1 + Ka·albumin). */
function bioavailableTestosterone(totalT_nmoll: number, shbg_nmoll: number, albumin_gdl?: number): number {
  const A = albuminMolL(albumin_gdl);
  const FT = vermeulenFreeT(totalT_nmoll * 1e-9, shbg_nmoll * 1e-9, A);
  return (FT * (1 + KA_ALBUMIN * A)) / 1e-9;
}

/** Testosterone's three pools, nmol/L: free, albumin-bound (free × Ka·albumin) and SHBG-bound (the rest). */
export function testosteronePools(totalT_nmoll: number, shbg_nmoll: number, albumin_gdl: number) {
  const A = albuminMolL(albumin_gdl);
  const free = vermeulenFreeT(totalT_nmoll * 1e-9, shbg_nmoll * 1e-9, A) / 1e-9;
  const albuminBound = free * KA_ALBUMIN * A;
  return { free, albuminBound, shbgBound: totalT_nmoll - free - albuminBound };
}

export const INDEX_DEFS: IndexDef[] = [
  {
    key: 'ka', friendlyName: 'Atherogenic coefficient', shortName: 'AC', panels: ['Cardiovascular Risk'],
    formula: '(TC − HDL) / HDL', cut: [3, 4], inputKeys: ['TC', 'HDL-C'], level: 'heuristic',
    meaning: 'Share of atherogenic cholesterol relative to protective HDL. Higher = more atherogenic blood. Rough guide: <3 good, 3–4 borderline, >4 high.',
    consensus: 'Common in post-Soviet labs; in international guidelines superseded by ApoB and direct ratios. Fine as a rough orientation.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "American Heart Association (Framingham Heart Study)", document: "Prediction of Coronary Heart Disease Using Risk Factor Categories (Wilson PWF et al.)", year: 1998, url: "https://www.ahajournals.org/doi/10.1161/01.CIR.97.18.1837", doi: "10.1161/01.CIR.97.18.1837", quote: "AC = (TC−HDL)/HDL is algebraically TC/HDL − 1, so it carries the same information as the Framingham total/HDL ratio; the cut-points here are post-Soviet (Klimov) orientation values with no international guideline validation." },
    ],
    fn: (m) => (has(m, 'TC', 'HDL-C') ? (m['TC']! - m['HDL-C']!) / m['HDL-C']! : null),
  },
  {
    key: 'tchdl', friendlyName: 'TC / HDL ratio', shortName: 'TC/HDL', panels: ['Cardiovascular Risk'],
    formula: 'TC / HDL', cut: [3.5, 5], inputKeys: ['TC', 'HDL-C'], level: 'consensus', loinc: '9830-1',
    meaning: 'Total cholesterol per unit of protective HDL. Simple, robust cardiovascular-risk marker. Target usually <3.5–4.',
    consensus: 'Well-established CV-risk marker, used in risk calculators (e.g. Framingham). Good evidence base.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "American Heart Association (Framingham Heart Study)", document: "Prediction of Coronary Heart Disease Using Risk Factor Categories (Wilson PWF et al.)", year: 1998, url: "https://www.ahajournals.org/doi/10.1161/01.CIR.97.18.1837", doi: "10.1161/01.CIR.97.18.1837", quote: "Total cholesterol and HDL-cholesterol categories are used to predict coronary heart disease risk; the total/HDL ratio is a long-standing Framingham risk marker." },
    ],
    fn: (m) => (has(m, 'TC', 'HDL-C') ? m['TC']! / m['HDL-C']! : null),
  },
  {
    key: 'ldlhdl', friendlyName: 'LDL / HDL ratio', shortName: 'LDL/HDL', panels: ['Cardiovascular Risk'],
    formula: 'LDL / HDL', cut: [2, 3.5], inputKeys: ['LDL-C', 'HDL-C'], level: 'heuristic', loinc: '11054-4',
    meaning: 'Direct ratio of atherogenic LDL to protective HDL. More LDL-sensitive than TC/HDL. Target <2–3.',
    consensus: 'Long used and intuitive, but current guidance considers ApoB / non-HDL more accurate.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "European Society of Cardiology / European Atherosclerosis Society", document: "2019 ESC/EAS Guidelines for the management of dyslipidaemias (Mach F et al.)", year: 2020, url: "https://academic.oup.com/eurheartj/article/41/1/111/5556353", doi: "10.1093/eurheartj/ehz455", quote: "Guidelines set treatment targets for LDL-C, non-HDL-C and ApoB; the LDL/HDL ratio has no formal guideline target, so the cut-points here are orientation only." },
    ],
    fn: (m) => (has(m, 'LDL-C', 'HDL-C') ? m['LDL-C']! / m['HDL-C']! : null),
  },
  {
    key: 'aip', friendlyName: 'AIP (atherogenic index of plasma)', shortName: 'AIP', panels: ['Insulin Resistance', 'Cardiovascular Risk'],
    formula: 'log₁₀(TG / HDL), molar', cut: [0.11, 0.21], inputKeys: ['TRIG', 'HDL-C'],
    inputUnits: { TRIG: 'mmol/L', 'HDL-C': 'mmol/L' }, level: 'heuristic',
    meaning: 'Reflects LDL particle size and insulin resistance. Scale: <0.11 low risk, 0.11–0.21 medium, >0.21 high.',
    consensus: 'A studied statistical surrogate, not a consensus-endorsed clinical test: its own defining paper and the follow-on literature are observational-association studies (correlation with LDL particle size, CAD severity, metabolic syndrome), and no named guideline or consensus statement recommends AIP for clinical risk use. Most useful as orientation with high triglycerides / metabolic syndrome.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Clinical Biochemistry (Dobiásová M, Frohlich J)", document: "The plasma parameter log(TG/HDL-C) as an atherogenic index", year: 2001, url: "https://pubmed.ncbi.nlm.nih.gov/11738396/", doi: "10.1016/S0009-9120(01)00263-6", quote: "Introduces AIP = log10(TG/HDL-C) in molar units, correlating with LDL particle size and cholesterol esterification rate; the <0.11 / 0.11–0.21 / >0.21 risk bands originate here." },
    ],
    fn: (m) => (has(m, 'TRIG', 'HDL-C') ? Math.log10(m['TRIG']! / m['HDL-C']!) : null),
  },
  {
    key: 'nonhdl', friendlyName: 'Non-HDL cholesterol', shortName: 'Non-HDL-C', panels: ['Cardiovascular Risk'],
    formula: 'TC − HDL (mg/dL)', cut: [130, 160], unit: 'mg/dL', inputKeys: ['TC', 'HDL-C'],
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
    key: 'remnant', friendlyName: 'Remnant cholesterol', shortName: 'Remnant-C', panels: ['Cardiovascular Risk'],
    formula: 'TC − HDL − LDL (mg/dL)', cut: [24, 30], unit: 'mg/dL', inputKeys: ['TC', 'HDL-C', 'LDL-C'],
    inputUnits: { TC: 'mg/dL', 'HDL-C': 'mg/dL', 'LDL-C': 'mg/dL' }, level: 'consensus',
    meaning: 'Cholesterol in triglyceride-rich lipoproteins (VLDL and remnants). Independent CV-risk and vascular-inflammation factor. Target <24 mg/dL (~0.6 mmol/L).',
    consensus: 'Accumulating evidence as a causal driver of atherosclerosis; increasingly used.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "Journal of the American College of Cardiology (Varbo A, Nordestgaard BG et al.)", document: "Remnant Cholesterol as a Causal Risk Factor for Ischemic Heart Disease", year: 2013, url: "https://pubmed.ncbi.nlm.nih.gov/23265341/", doi: "10.1016/j.jacc.2012.08.1026", quote: "Mendelian-randomization evidence that elevated remnant cholesterol (TC − HDL-C − LDL-C) is causally associated with ischemic heart disease; supports the ~0.6 mmol/L (~24 mg/dL) orientation threshold. In this app, the LDL-C subtracted is whatever the lab reports under LOINC 13457-7 — the 'by calculation' code, typically Friedewald (TC − HDL-C − TG/5) — so TC − HDL-C − LDL-C reduces algebraically to that same TG/5 VLDL-C estimate whenever the lab's LDL-C is Friedewald-derived, making Remnant-C not an independent number in that case." },
    ],
    fn: (m) => (has(m, 'TC', 'HDL-C', 'LDL-C') ? m['TC']! - m['HDL-C']! - m['LDL-C']! : null),
  },
  {
    key: 'vldl', friendlyName: 'VLDL cholesterol', shortName: 'VLDL-C', panels: ['Cardiovascular Risk'],
    formula: 'TG / 5 (mg/dL)', cut: [30, 40], unit: 'mg/dL', inputKeys: ['TRIG'],
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
    key: 'ldlf', friendlyName: 'LDL-C (Friedewald)', shortName: 'LDL-C (F)', panels: ['Cardiovascular Risk'],
    formula: 'TC − HDL − TG/5 (mg/dL)\nonly when TG < 400 mg/dL', cut: [100, 160], unit: 'mg/dL',
    inputKeys: ['TC', 'HDL-C', 'TRIG'],
    inputUnits: { TC: 'mg/dL', 'HDL-C': 'mg/dL', TRIG: 'mg/dL' }, level: 'consensus', loinc: '13457-7',
    meaning: 'LDL cholesterol estimated by the 1972 Friedewald equation — the formula most labs have used for half a century, computed here from YOUR TC, HDL and TG so the series stays method-consistent even when labs change formulas between draws. Compare it with the lab-reported LDL-C row: a gap means the lab used a different method, not that your LDL moved. There is no universal LDL-C cutoff — the target is risk-stratified (2019 ESC/EAS: <55 mg/dL very high risk · <70 high · <100 moderate · <115 low), so pick the line that matches your own risk. The bands here are the NCEP ATP III DESCRIPTIVE categories, not a target: <100 optimal/near optimal · 100–159 near optimal to borderline · ≥160 high (≥190 very high). Beware the units: in mmol/L the last term is TG/2.2, not TG/5 — this index converts every input to mg/dL first, so the /5 always applies to mg/dL.',
    consensus: 'The long-standing standard estimate, and still the default in most labs, but it is an approximation with known failure modes: it is invalid above TG 400 mg/dL (no value is produced there), and also invalid with chylomicronemia, type III dysbetalipoproteinemia, or a non-fasting sample. It underestimates most at low LDL-C combined with high TG — exactly the range where a treatment decision is being made — which is why newer equations (Martin-Hopkins, Sampson/NIH) were developed. Needs TC, HDL-C and TG from ONE draw.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "Clinical Chemistry (Friedewald WT, Levy RI, Fredrickson DS)", document: "Estimation of the concentration of low-density lipoprotein cholesterol in plasma, without use of the preparative ultracentrifuge", year: 1972, url: "https://pubmed.ncbi.nlm.nih.gov/4337382/", doi: "10.1093/clinchem/18.6.499", quote: "LDL-C = TC − HDL-C − TG/5 (mg/dL), with VLDL-C approximated as TG/5; the estimate is stated as valid only when TG <400 mg/dL and not applicable to type III dysbetalipoproteinemia or chylomicronemic samples. In mmol/L the triglyceride term is TG/2.2." },
      { organization: "National Cholesterol Education Program (NCEP) Expert Panel", document: "Third Report (ATP III), JAMA", year: 2001, url: "https://pubmed.ncbi.nlm.nih.gov/11368702/", doi: "10.1001/jama.285.19.2486", quote: "LDL-C descriptive categories (mg/dL): <100 optimal, 100–129 near optimal/above optimal, 130–159 borderline high, 160–189 high, ≥190 very high — the source of the bands used here." },
      { organization: "European Society of Cardiology / European Atherosclerosis Society", document: "2019 ESC/EAS Guidelines for the management of dyslipidaemias (Mach F et al.)", year: 2020, url: "https://academic.oup.com/eurheartj/article/41/1/111/5556353", doi: "10.1093/eurheartj/ehz455", quote: "LDL-C goals are risk-stratified, not universal: <1.4 mmol/L (~55 mg/dL) very-high risk, <1.8 (~70) high, <2.6 (~100) moderate, <3.0 (~115) low risk." },
    ],
    // Friedewald's TG/5 term stops approximating VLDL-C above TG 400 mg/dL, so
    // no value is produced there rather than a confidently wrong one.
    fn: (m) =>
      has(m, 'TC', 'HDL-C', 'TRIG') && m['TRIG']! < 400
        ? m['TC']! - m['HDL-C']! - m['TRIG']! / 5
        : null,
  },
  {
    key: 'ldls', friendlyName: 'LDL-C (Sampson)', shortName: 'LDL-C (S)', panels: ['Cardiovascular Risk'],
    formula: 'TC/0.948 − HDL/0.971\n− (TG/8.56 + TG×nonHDL/2140 − TG²/16100)\n− 9.44 (mg/dL)\nnonHDL = TC − HDL; only when TG ≤ 800 mg/dL',
    cut: [100, 160], unit: 'mg/dL', inputKeys: ['TC', 'HDL-C', 'TRIG'],
    inputUnits: { TC: 'mg/dL', 'HDL-C': 'mg/dL', TRIG: 'mg/dL' }, level: 'consensus',
    meaning: 'LDL cholesterol estimated by the 2020 Sampson (NIH equation 2) formula, from the same three inputs as the Friedewald row above. It was derived against beta-quantification ultracentrifugation to fix exactly where Friedewald fails: it stays valid up to TG 800 mg/dL and is markedly more accurate at low LDL-C with high triglycerides. Read the two side by side — where they agree, the estimate is solid; where Sampson reads higher, Friedewald is under-reporting. Same caveat on thresholds: there is no universal LDL-C cutoff, targets are risk-stratified (2019 ESC/EAS: <55 mg/dL very high risk · <70 high · <100 moderate · <115 low). The bands here are the NCEP ATP III descriptive categories (<100 optimal · 100–159 near optimal to borderline · ≥160 high), used for coloring only.',
    consensus: 'The 2026 ACC/AHA/Multisociety Dyslipidemia Guideline gives a Class 1 (strong), Level B-NR recommendation that either the Martin/Hopkins or the Sampson/NIH equation is preferred over the Friedewald equation for LDL-C — not merely "increasingly adopted," a formal guideline preference. Reported alongside Friedewald in current lipid literature. Limits: validated only to TG ≤ 800 mg/dL (no value is produced above that), and patients with type III hyperlipidemia were excluded from the derivation cohort, so it is not validated there. No LOINC code exists for a Sampson/NIH-equation LDL-C, so this index has none — the generic "LDL-C by calculation" code names a different method. Needs TC, HDL-C and TG from ONE draw.',
    evidenceLevel: 'guideline',
    references: [
      { organization: "JAMA Cardiology (Sampson M, Ling C, Sun Q, et al.)", document: "A New Equation for Calculation of Low-Density Lipoprotein Cholesterol in Patients With Normolipidemia and/or Hypertriglyceridemia", year: 2020, url: "https://pubmed.ncbi.nlm.nih.gov/32101259/", doi: "10.1001/jamacardio.2020.0013", quote: "Derives NIH equation 2, LDL-C = TC/0.948 − HDL-C/0.971 − (TG/8.56 + TG×nonHDL-C/2140 − TG²/16100) − 9.44, against beta-quantification; validated for TG up to 800 mg/dL, with type III hyperlipidemia excluded from the derivation cohort." },
      { organization: "American College of Cardiology / American Heart Association Joint Committee on Clinical Practice Guidelines", document: "2026 ACC/AHA/AACVPR/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on the Management of Dyslipidemia, JACC", year: 2026, url: "https://www.jacc.org/doi/10.1016/j.jacc.2025.11.016", doi: "10.1016/j.jacc.2025.11.016", quote: "Use of either the Martin/Hopkins equation or the Sampson/National Institutes of Health (NIH) equation is preferred over calculation by the Friedewald equation to estimate LDL-C. (1, B-NR)" },
      { organization: "National Cholesterol Education Program (NCEP) Expert Panel", document: "Third Report (ATP III), JAMA", year: 2001, url: "https://pubmed.ncbi.nlm.nih.gov/11368702/", doi: "10.1001/jama.285.19.2486", quote: "LDL-C descriptive categories (mg/dL): <100 optimal, 100–129 near optimal/above optimal, 130–159 borderline high, 160–189 high, ≥190 very high — the source of the bands used here." },
    ],
    // Derived and validated only to TG 800 mg/dL; above that no value is produced.
    fn: (m) => {
      if (!has(m, 'TC', 'HDL-C', 'TRIG') || m['TRIG']! > 800) return null;
      const tc = m['TC']!;
      const tg = m['TRIG']!;
      const nonHdl = tc - m['HDL-C']!;
      return tc / 0.948 - m['HDL-C']! / 0.971 - (tg / 8.56 + (tg * nonHdl) / 2140 - (tg * tg) / 16100) - 9.44;
    },
  },
  {
    key: 'apobapoa', friendlyName: 'ApoB / ApoA1', shortName: 'ApoB/ApoA', panels: ['Cardiovascular Risk'],
    formula: 'ApoB / ApoA1', cut: [0.7, 0.9], inputKeys: ['ApoB', 'ApoA1'], level: 'consensus', loinc: '1874-7',
    // The ratio itself is unit-free, but only if both sides are on one scale:
    // labs print apolipoproteins as mg/dL or as g/L, a factor of 100 apart.
    inputUnits: { ApoB: 'mg/dL', ApoA1: 'mg/dL' },
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
    key: 'tyg', friendlyName: 'TyG index', shortName: 'TyG', panels: ['Insulin Resistance'],
    formula: 'ln(TG[mg/dL] × glucose[mg/dL] / 2)', cut: [8.5, 9], inputKeys: ['TRIG', 'GLU'],
    inputUnits: { TRIG: 'mg/dL', GLU: 'mg/dL' }, level: 'heuristic',
    meaning: 'Surrogate of insulin resistance from triglycerides and glucose — no insulin needed. Guide: <8.5 normal, >9 marked IR.',
    consensus: 'A studied surrogate for insulin resistance, not a consensus-endorsed one: the evidence linking it to IR and cardiometabolic outcomes is observational, with no interventional data showing that lowering TyG improves outcomes and no agreed cutoff across studies, so no named guideline recommends it as a clinical risk test. Convenient (no insulin assay) — needs fasting TG and glucose from one draw.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Metabolic Syndrome and Related Disorders (Simental-Mendía LE, Rodríguez-Morán M, Guerrero-Romero F)", document: "The Product of Fasting Glucose and Triglycerides as Surrogate for Identifying Insulin Resistance in Apparently Healthy Subjects", year: 2008, url: "https://pubmed.ncbi.nlm.nih.gov/19067533/", doi: "10.1089/met.2008.0034", quote: "Defines TyG = Ln[fasting TG(mg/dL) × fasting glucose(mg/dL)/2] as a surrogate of insulin resistance validated against HOMA-IR; the ~8.5–9 bands derive from this and follow-on clamp-validation work." },
    ],
    fn: (m) => (has(m, 'TRIG', 'GLU') ? Math.log((m['TRIG']! * m['GLU']!) / 2) : null),
  },
  {
    key: 'gi', friendlyName: 'Glucose / insulin ratio', shortName: 'Glu/Insulin', panels: ['Insulin Resistance'],
    formula: 'glucose(mg/dL) / insulin(µIU/mL)', cut: [7, 4.5], hi: true, inputKeys: ['GLU', 'Insulin'],
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
    key: 'homair', friendlyName: 'HOMA-IR', shortName: 'HOMA-IR', panels: ['Insulin Resistance', 'Pancreatic Function'],
    formula: 'glucose(mmol/L) × insulin(µIU/mL) / 22.5', cut: [2, 2.9], inputKeys: ['GLU', 'Insulin'],
    inputUnits: { GLU: 'mmol/L' }, level: 'consensus',
    meaning: 'Model-based fasting insulin-resistance estimate (the HOMA model), not a direct measurement. Guide: <2 normal · 2–2.9 borderline / early insulin resistance · ≥2.9 insulin resistance.',
    consensus: 'Standard IR screening index. Requires fasting glucose AND insulin from one draw — insulin not yet measured.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "Diabetologia (Matthews DR et al.)", document: "Homeostasis model assessment: insulin resistance and beta-cell function from fasting plasma glucose and insulin concentrations in man", year: 1985, url: "https://pubmed.ncbi.nlm.nih.gov/3899825/", doi: "10.1007/BF00280883", quote: "HOMA-IR = fasting glucose(mmol/L) × fasting insulin(µU/mL) / 22.5. Population-specific cut-points (~2–2.9) are commonly used but not a single fixed guideline threshold." },
    ],
    fn: (m) => (has(m, 'GLU', 'Insulin') ? (m['GLU']! * m['Insulin']!) / 22.5 : null),
  },
  {
    key: 'homab', friendlyName: 'HOMA-%B (beta-cell function)', shortName: 'HOMA-%B', panels: ['Pancreatic Function', 'Insulin Resistance'],
    formula: '20 × insulin(µIU/mL) / (glucose(mmol/L) − 3.5)', cut: [80, 50], hi: true, unit: '%', inputKeys: ['GLU', 'Insulin'],
    inputUnits: { GLU: 'mmol/L' }, level: 'heuristic',
    meaning: 'A model-based fasting estimate of beta-cell function, from the SAME fasting glucose + insulin pair as HOMA-IR (one draw, both fasting) — not a direct measurement of cell mass or a count of surviving beta cells. 100% is the value the HOMA model assigns to normal beta-cell function in its reference population, not a ceiling of total pancreatic capacity — %B expresses basal insulin output RELATIVE TO that reference, and lower means the beta cells are no longer keeping up relative to it, not that a defined fraction of cells has died or that the pancreas is failing outright. It must be read NEXT TO HOMA-IR, never alone: the two answer different halves of one question — HOMA-IR says how resistant the tissues are, %B says whether the pancreas can still compensate. A calm HOMA-IR with a low %B is a real pattern: no insulin resistance, but the beta cells are under-delivering, and glucose creeps up anyway. Guide: >80% good · 50–80% borderline · <50% low — orientation only, HOMA-%B has no agreed cut-points. And one draw is one point, not a trend.',
    consensus: 'Deliberately graded HEURISTIC, not consensus, for two honest reasons. (1) HOMA1\'s linear approximation is imprecise — the original paper reports a coefficient of variation around 32%; the non-linear HOMA2 model is the better estimator and this engine does not implement it. (2) The HOMA authors explicitly list measuring beta-cell function in isolation among the model\'s inappropriate uses; %B is meaningful only alongside HOMA-IR, which is why it is shipped on the same lenses and never on its own. Requires fasting glucose AND insulin from ONE draw — computed only where both exist on the same date, never paired across dates. Undefined when fasting glucose ≤ 3.5 mmol/L (the formula\'s denominator), in which case no value is produced.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Diabetologia (Matthews DR et al.)", document: "Homeostasis model assessment: insulin resistance and beta-cell function from fasting plasma glucose and insulin concentrations in man", year: 1985, url: "https://pubmed.ncbi.nlm.nih.gov/3899825/", doi: "10.1007/BF00280883", quote: "Source of the HOMA1 %B approximation, %B = 20 × insulin(µU/mL) / (glucose(mmol/L) − 3.5), and of the ~32% coefficient of variation that makes a single estimate imprecise." },
      { organization: "Diabetes Care (Wallace TM, Levy JC, Matthews DR)", document: "Use and abuse of HOMA modeling", year: 2004, url: "https://pubmed.ncbi.nlm.nih.gov/15161807/", doi: "10.2337/diacare.27.6.1487", quote: "The HOMA authors' own guidance on appropriate use: HOMA2 is preferred over the HOMA1 linear approximation, and measuring beta-cell function in isolation is named as an inappropriate use of the model — %B is to be read together with HOMA-IR." },
    ],
    fn: (m) => (has(m, 'GLU', 'Insulin') && m['GLU']! > 3.5 ? (20 * m['Insulin']!) / (m['GLU']! - 3.5) : null),
  },
  {
    key: 'cft', friendlyName: 'Free testosterone (calculated)', shortName: 'cFT', panels: ['Hypogonadism'],
    formula: 'free T = (−b + √(b²−4ac)) / 2a\na = N·Ks\nb = N + Ks(SHBG−T)\nc = −T\nN = 1 + Ka·albumin\n(Vermeulen equation, all in mol/L)',
    cut: [100, 65], unit: 'pg/mL', hi: true, inputKeys: ['T', 'SHBG'], optionalInputKeys: ['ALB'],
    inputUnits: { T: 'ng/dL', SHBG: 'nmol/L', ALB: 'g/dL' }, level: 'consensus', loinc: '103227-5',
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
    key: 'biot', friendlyName: 'Bioavailable testosterone', shortName: 'Bio-T', panels: ['Hypogonadism'],
    formula: 'bio-T = free T × (1 + Ka·albumin)\nfree T = Vermeulen quadratic (as cFT)\nKa = 3.6×10⁴ L/mol, Ks = 1.0×10⁹ L/mol\n(all in mol/L, result in nmol/L)',
    unit: 'nmol/L', inputKeys: ['T', 'SHBG'], optionalInputKeys: ['ALB'],
    bandsBySex: {
      male: { cut: [biotNmol(BIOT_NGDL.male20s), biotNmol(BIOT_NGDL.male60s)], hi: true },
      female: { cut: [biotNmol(BIOT_NGDL.femaleOralEstrogen), biotNmol(BIOT_NGDL.female)] },
    },
    inputUnits: { T: 'nmol/L', SHBG: 'nmol/L', ALB: 'g/dL' }, level: 'consensus',
    meaning: 'Testosterone that is not locked up by SHBG: the free fraction plus the fraction weakly bound to albumin, which lets go easily enough to reach tissues. Computed from total T, SHBG and albumin with the same Vermeulen equation as cFT — free T first, then free T × (1 + Ka·albumin), Ka = 3.6×10⁴ L/mol — in nmol/L. If no albumin reading from the same draw can be placed in g/dL (g/L is converted), albumin is taken as 4.3 g/dL (43 g/L), the value the ISSAM calculator pre-fills; the result is then an estimate for a normal albumin and is unreliable when albumin is far from it. Albumin is turned into mol/L with the calculator\'s 69,000 g/mol convention. ' +
      `Its bands depend on sex, so the value carries no status until Sex is set in Database details. Men: >${biotShown(BIOT_NGDL.male20s)} within range at every age · ${biotShown(BIOT_NGDL.male60s)}–${biotShown(BIOT_NGDL.male20s)} borderline · <${biotShown(BIOT_NGDL.male60s)} low. Women: <${biotShown(BIOT_NGDL.femaleOralEstrogen)} within range · ${biotShown(BIOT_NGDL.femaleOralEstrogen)}–${biotShown(BIOT_NGDL.female)} borderline · >${biotShown(BIOT_NGDL.female)} high. ` +
      `Both come from Mayo Clinic Laboratories' reference intervals, converted from ng/dL with testosterone's molar mass. Mayo gives men a lower limit per decade from 20 to 69, falling from ${BIOT_NGDL.male20s} ng/dL in the twenties to ${BIOT_NGDL.male60s} ng/dL in the sixties; this app uses no age, so the men's borderline band is exactly the span that is low for a younger man and normal for an older one. Women's intervals (ages 20–50, ovaries intact) end at ${BIOT_NGDL.femaleOralEstrogen} ng/dL on oral estrogen and ${BIOT_NGDL.female} ng/dL off it; the app does not know which applies, so the women's borderline band is the span that is normal only off oral estrogen. Not flagged: men's upper and women's lower limits, and nothing marks the ages Mayo leaves unestablished (men under 20 or 70 and over, women under 20 or over 50), where the bands are extrapolated.`,
    consensus: 'Calculated, not measured: the defining paper validated it against the ammonium-sulfate precipitation method for non-SHBG-bound T and found the two almost identical, and labs report it by exactly this calculation. Like cFT it is unreliable when steroids crowd SHBG\'s binding sites (pregnancy, high DHT on treatment) and with greatly abnormal albumin. It carries the same information as cFT scaled by the albumin term, so the two move together; no guideline prefers bioavailable over free T. Nor does any set a cut-off for it: the Endocrine Society\'s hypogonadism guideline notes that no study relates bioavailable T to the manifestations of deficiency, and the EAU guideline sets its diagnostic threshold on total T. The bands are therefore a major reference laboratory\'s reference intervals, not diagnostic thresholds — and Mayo measures its figure (differential precipitation, then LC-MS/MS) rather than calculating it, which the defining paper found almost identical to this calculation.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "Journal of Clinical Endocrinology & Metabolism (Vermeulen A, Verdonck L, Kaufman JM)", document: "A critical evaluation of simple methods for the estimation of free testosterone in serum", year: 1999, url: "https://pubmed.ncbi.nlm.nih.gov/10523012/", doi: "10.1210/jcem.84.10.6079", retrieved: '2026-09-11', quote: "nonspecifically bound T, calculated from FT, … almost identical to … non-SHBG-T obtained by ammonium sulfate precipitation" },
      { organization: "ISSAM (Hormonology department, University Hospital of Ghent)", document: "Free & Bioavailable Testosterone calculator", url: "https://www.issam.ch/freetesto.htm", doi: null, retrieved: '2026-09-11', quote: "bioavailable testosterone includes free plus weakly bound to albumin." },
      { organization: "Mayo Clinic Laboratories", document: "Test catalog, TTBS: Testosterone, Total and Bioavailable, Serum — Reference Values", url: "https://www.mayocliniclabs.com/test-catalog/overview/80065", doi: null, retrieved: '2026-09-11', quote: "TESTOSTERONE, BIOAVAILABLE: Males < or =19 years: Not established 20-29 years: 83-257 ng/dL 30-39 years: 72-235 ng/dL 40-49 years: 61-213 ng/dL 50-59 years: 50-190 ng/dL 60-69 years: 40-168 ng/dL > or =70 years: Not established Females (non-oophorectomized) < or =19 years: not established 20-50 years (on oral estrogen): 0.80-4.0 ng/dL 20-50 years (not on oral estrogen): 0.80-10 ng/dL >50 years: Not established" },
      { organization: "Endocrine Society (Bhasin S et al.)", document: "Testosterone Therapy in Men With Hypogonadism: An Endocrine Society Clinical Practice Guideline, JCEM", year: 2018, url: "https://academic.oup.com/jcem/article/103/5/1715/4939465", doi: "10.1210/jc.2018-00229", retrieved: '2026-09-11', quote: "there are no detailed studies (similar to those described previously that relate FT concentrations to manifestations of T deficiency) that use bioavailable T concentrations" },
    ],
    fn: (m) => (has(m, 'T', 'SHBG') ? bioavailableTestosterone(m['T']!, m['SHBG']!, m['ALB']) : null),
  },
  {
    key: 'fai', friendlyName: 'Free androgen index', shortName: 'FAI', panels: ['Hypogonadism'],
    formula: 'T / SHBG × 100 (both nmol/L), %', cut: [35, 24], hi: true, unit: '%', inputKeys: ['T', 'SHBG'],
    inputUnits: { T: 'nmol/L', SHBG: 'nmol/L' }, level: 'heuristic', loinc: '24125-7',
    meaning: 'A simpler, older alternative to the calculated free testosterone (cFT) above — both estimate the same thing (bioavailable androgen) from the same two inputs, total T and SHBG, but FAI is just their raw ratio ×100, without cFT\'s equilibrium-binding math. Because SHBG sits directly in the denominator, FAI is more sensitive to SHBG level itself than cFT is — a shift in SHBG (from thyroid status, obesity, aging, liver disease…) moves FAI even when true free T hasn\'t changed. Guide, adult men: >35% good/within reference range · 24–35% borderline-low · <24% low. Bands anchored to a clinical lab\'s own male reference intervals for ages 20–49 (35.0–92.6%) and ≥50 (24.3–72.1%) — this app has no age profile, so one fixed pair stands in for the age-stratified ranges the source actually reports.',
    consensus: 'The Endocrine Society favors calculated free T over simple ratios like FAI when free T is needed — see cFT\'s consensus note above. Vermeulen\'s own validation paper (the same paper cFT\'s equation comes from) found the FAI/AFTC ratio varies with SHBG level, concluding FAI "is not a reliable index of bioavailable T." Kept here mainly because some labs and older literature still report it directly; when FAI and cFT disagree, trust cFT.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "Journal of Clinical Endocrinology & Metabolism (Vermeulen A, Verdonck L, Kaufman JM)", document: "A critical evaluation of simple methods for the estimation of free testosterone in serum", year: 1999, url: "https://pubmed.ncbi.nlm.nih.gov/10523012/", doi: "10.1210/jcem.84.10.6079", quote: "...the free androgen index (FAI = the ratio 100T/iSHBG)... Also, the FAI/AFTC ratio varied as a function of the SHBG levels, and hence, neither aFT nor FAI is a reliable index of bioavailable T." },
      { organization: "London Health Sciences Centre / St. Joseph's Health Care London (Pathology and Laboratory Medicine)", document: "Free Androgen Index and Calculated Free and Bioavailable Testosterone, Plasma/Serum — Lab Test Info Guide", url: "https://www.lhsc.on.ca/lab-test-info-guide/free-androgen-index-and-calculated-free-and-bioavailable-testosterone-plasma", doi: null, quote: "FAI = total testosterone (nmol/L)/SHBG (nmol/L) expressed as a percentage. Male reference range: 20–<50 years 35.0–92.6%; ≥50 years 24.3–72.1%." },
    ],
    fn: (m) => (has(m, 'T', 'SHBG') ? (m['T']! / m['SHBG']!) * 100 : null),
  },
  {
    key: 'tlh', friendlyName: 'T / LH ratio', shortName: 'T/LH', panels: ['Hypogonadism'],
    formula: 'T(ng/dL) / LH(mIU/mL)', cut: [100, 50], hi: true, inputKeys: ['T', 'LH'],
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
    key: 'te2', friendlyName: 'T / E2 ratio', shortName: 'T/E2', panels: ['Hypogonadism'],
    formula: 'T(ng/dL) / E2(pg/mL)', cut: [15, 10], hi: true, inputKeys: ['T', 'E2'],
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
    key: 'dhtt', friendlyName: 'DHT / T ratio (5α-reductase)', shortName: 'DHT/T', panels: ['Hypogonadism'],
    formula: 'DHT / T × 100, %', cut: [12, 18], unit: '%', inputKeys: ['DHT', 'T'],
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
    key: 'cortdhea', friendlyName: 'Cortisol / DHEA-S ratio', shortName: 'Cort/DHEA', panels: ['Adrenal'],
    formula: 'Cortisol / DHEA-S (molar, both nmol/L)', cut: [0.1, 0.2], inputKeys: ['Cortisol', 'DHEA-S'], level: 'heuristic',
    meaning: 'Balance between the catabolic stress hormone (cortisol) and the anabolic adrenal androgen reserve (DHEA-S), as a molar ratio with both in the same unit (nmol/L). Healthy adults sit around 0.03–0.10; a high ratio (high cortisol, low DHEA-S) is read as a chronic-stress / catabolic pattern. Guide (orientation only): <0.1 balanced · 0.1–0.2 borderline · >0.2 catabolic. Needs both from the same draw — you have plenty of cortisol but only one DHEA-S, and never together, so order them in one fasting morning draw.',
    consensus: 'Popular in functional / integrative medicine; weak support in conventional endocrinology and no agreed cutoff — treat as exploratory, not diagnostic.',
    evidenceLevel: 'heuristic',
    references: [
      { organization: "European Journal of Endocrinology (Phillips AC, Carroll D, Gale CR, Lord JM, Arlt W, Batty GD)", document: "Cortisol, DHEAS, their ratio and the metabolic syndrome: evidence from the Vietnam Experience Study", year: 2010, url: "https://pubmed.ncbi.nlm.nih.gov/20164211/", doi: "10.1530/EJE-09-1078", quote: "A higher cortisol:DHEAS ratio was associated with greater metabolic-syndrome risk; the ratio is a research/functional-medicine marker of catabolic-anabolic balance with no agreed diagnostic cutoff — bands here are orientation only." },
    ],
    // Both sides converted to nmol/L from the tabulated molar masses, not from
    // literals: cortisol 362.466 g/mol, DHEA-S 368.488 g/mol.
    fn: (m) =>
      has(m, 'Cortisol', 'DHEA-S')
        ? (m['Cortisol']! * CORTISOL_UGDL_TO_NMOLL) / (m['DHEA-S']! * DHEAS_UGDL_TO_NMOLL)
        : null,
  },
  {
    key: 'ft3ft4', friendlyName: 'FT3 / FT4 ratio', shortName: 'FT3/FT4', panels: ['Hypothyroidism'],
    formula: 'FT3 / FT4 (molar)', cut: [0.3, 0.2], hi: true, inputKeys: ['FT3', 'FT4'],
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
    key: 'deritis', friendlyName: 'De Ritis ratio (AST/ALT)', shortName: 'De Ritis', panels: ['Fatty Liver'],
    formula: 'AST / ALT', cut: [1.3, 2], inputKeys: ['AST', 'ALT'], level: 'consensus', loinc: '1916-6',
    meaning: 'Pattern of liver injury, not a standalone fatty-liver test: <1 is typical of fatty liver; >1 points to alcoholic/cirrhotic or muscle source; >2 especially concerning. Read as one clue to WHAT kind of injury is present, not as a way to diagnose or stage fatty liver on its own.',
    consensus: 'A classic hepatology index with a long track record for characterizing the pattern and likely source of liver injury (viral vs alcoholic vs muscle) — not a validated standalone test for diagnosing or staging fatty liver disease; its own cited review discusses the <1 fatty-liver pattern alongside other injury patterns, not as a steatosis/fibrosis assessment in itself.',
    evidenceLevel: 'consensus',
    references: [
      { organization: "The Clinical Biochemist Reviews (Botros M, Sikaris KA)", document: "The De Ritis Ratio: The Test of Time", year: 2013, url: "https://pubmed.ncbi.nlm.nih.gov/24353357/", doi: null, quote: "Reviews the AST/ALT (De Ritis) ratio: the differing half-lives of AST (~18 h) and ALT (~36 h) make the ratio reflect the time course and pattern of liver injury and its likely source (eg ALT>AST in acute viral hepatitis, AST>ALT in alcoholic hepatitis; ratio <1 typical in NAFLD, particularly in morbidly obese patients) — a discriminator of injury type, not a validated standalone diagnostic or staging test for fatty liver disease." },
    ],
    fn: (m) => (has(m, 'AST', 'ALT') ? m['AST']! / m['ALT']! : null),
  },
  {
    key: 'tsat', friendlyName: 'Transferrin saturation', shortName: 'TSAT', panels: ['Anemia'],
    formula: 'serum iron / TIBC × 100, %', cut: [20, 15], unit: '%', hi: true, inputKeys: ['Fe', 'TIBC'],
    level: 'consensus', loinc: '2502-3',
    meaning: 'How full the iron-transport protein (transferrin) is running. Low is the iron-deficiency signal: 20–45% normal · 15–20 low · <15 clear deficiency. More dynamic than ferritin, so they\'re read together. Note the other end — a HIGH saturation (>45%) means iron overload / hemochromatosis (flagged via ferritin on the Hypogonadism lens).',
    consensus: 'Guideline-backed on both ends of its range: the ACG hemochromatosis guideline sets ≥45% as the recommended overload-screening threshold, and the BSG iron-deficiency-anaemia guideline names transferrin saturation, in a graded consensus recommendation, as a helpful test when a false-normal ferritin is suspected. Standard part of the iron panel; interpreted alongside ferritin, not in place of it.',
    evidenceLevel: 'guideline',
    references: [
      { organization: "American College of Gastroenterology (Kowdley KV, Brown KE, Ahn J, Sundaram V)", document: "ACG Clinical Guideline: Hereditary Hemochromatosis, Am J Gastroenterol", year: 2019, url: "https://pubmed.ncbi.nlm.nih.gov/31335359/", doi: "10.14309/ajg.0000000000000315", quote: "A fasting transferrin saturation ≥45% is the recommended screening threshold for iron overload; conversely a low saturation (<~20%, with <15% clear) signals iron deficiency — the thresholds used here." },
      { organization: "British Society of Gastroenterology (Snook J, Bhala N, Beales ILP, et al.)", document: "British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in adults, Gut", year: 2021, url: "https://pubmed.ncbi.nlm.nih.gov/34497146/", doi: "10.1136/gutjnl-2021-325210", quote: "We recommend that iron deficiency should be confirmed by iron studies prior to investigation. Serum ferritin is the single most useful marker of IDA, but other blood tests (eg, transferrin saturation) can be helpful if a false-normal ferritin is suspected (evidence quality—medium, consensus—92%, statement strength—strong)." },
    ],
    fn: (m) => (has(m, 'Fe', 'TIBC') ? (m['Fe']! / m['TIBC']!) * 100 : null),
  },
];
