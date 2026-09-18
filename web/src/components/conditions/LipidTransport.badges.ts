import { MARKER_CANDIDATE_LOINCS } from '../../data/computedIndices';
import { LIPOPROTEIN_PARTICLES } from '../../data/lipoproteinParticles';
import { indexDefOf, withVariants, type CitedSource } from './pathwayShared';

/** Lipid Transport's measures by name, its badges' prose, targets and sources, and the two chip cards' cited claims. */

export interface MarkerSpec {
  kind: 'marker';
  loincs: string[];
  display?: { si: string; us: string; molarMass: string };
}

export interface IndexSpec {
  kind: 'index';
  key: string;
}

export const CHOLESTEROL_UNITS = { si: 'mmol/L', us: 'mg/dL', molarMass: 'cholesterol' } as const;
const TRIGLYCERIDE_UNITS = { si: 'mmol/L', us: 'mg/dL', molarMass: 'triglyceride' } as const;

const indexInput = (marker: string) => MARKER_CANDIDATE_LOINCS[marker] ?? [];

export const MARKERS = {
  TC: { kind: 'marker', loincs: indexInput('TC'), display: CHOLESTEROL_UNITS },
  TG: { kind: 'marker', loincs: indexInput('TRIG'), display: TRIGLYCERIDE_UNITS },
  HDL: { kind: 'marker', loincs: indexInput('HDL-C'), display: CHOLESTEROL_UNITS },
  LDL: { kind: 'marker', loincs: indexInput('LDL-C'), display: CHOLESTEROL_UNITS },
  VLDL: { kind: 'marker', loincs: withVariants('13458-5'), display: CHOLESTEROL_UNITS },
  APOB: { kind: 'marker', loincs: indexInput('ApoB') },
  APOA1: { kind: 'marker', loincs: indexInput('ApoA1') },
  LPA: { kind: 'marker', loincs: withVariants('10835-7') },
} as const satisfies Record<string, MarkerSpec>;

export const idx = (key: string): IndexSpec => ({ kind: 'index', key });

// ---- badges ----

const regions = (region: string, particles: readonly string[]) => particles.map((p) => `${p}-${region}`);
const ALL_PARTICLES = LIPOPROTEIN_PARTICLES.map((p) => p.id);
const APOB_PILLS = regions('apo', ['vldl', 'idl', 'ldl', 'lpa']);

const APOB_MEANING =
  'Each VLDL, IDL, LDL and Lp(a) particle carries exactly one ApoB-100, so ApoB counts atherogenic particles, while LDL-C measures their cholesterol cargo. When they disagree — e.g. many small, cholesterol-poor LDL particles — ApoB tracks risk more accurately.';

const APOB_SOURCES: readonly CitedSource[] = [
  {
    organization: 'JAMA Cardiology (Sniderman AD, Thanassoulis G, Glavinovic T, et al.)',
    title: 'Apolipoprotein B Particles and Cardiovascular Disease: A Narrative Review',
    url: 'https://doi.org/10.1001/jamacardio.2019.3780',
    year: 2019,
    retrieved: '2026-09-16',
    quote: 'apoB more accurately measures the atherogenic risk owing to the apoB lipoproteins than does low-density lipoprotein cholesterol',
  },
];

export interface MethodsSpec {
  reported: MarkerSpec;
  /** The estimate the face falls back to when the lab reported none. */
  fallback: string;
  calculated: readonly (readonly [key: string, method: string])[];
  /** The badge cites only these, in this order, matched by title; INDEX_DEFS keeps the full lists. */
  sourceTitles: readonly string[];
}

export interface BadgeSpec {
  id: string;
  name: string;
  measure: MarkerSpec | IndexSpec;
  meaning: string;
  sources?: readonly CitedSource[];
  methods?: MethodsSpec;
  /** The particles the badge's association lines ring. */
  targets: readonly string[];
}

const indexBadge = (key: string, targets: readonly string[]): BadgeSpec => {
  const def = indexDefOf(key);
  return { id: key, name: def?.shortName ?? key, measure: idx(key), meaning: def?.meaning ?? '', targets };
};

const LDL_METHODS: MethodsSpec = {
  reported: MARKERS.LDL,
  fallback: 'ldlmh',
  calculated: [
    ['ldlf', 'Friedewald'],
    ['ldls', 'Sampson'],
    ['ldlmh', 'Martin-Hopkins'],
  ],
  sourceTitles: [
    'Estimation of the concentration of low-density lipoprotein cholesterol',
    'A New Equation for Calculation of Low-Density Lipoprotein Cholesterol',
    'Comparison of a Novel Method vs the Friedewald Equation',
    'Third Report (ATP III)',
  ],
};

export const BADGES: readonly BadgeSpec[] = [
  {
    id: 'tc',
    name: 'Total cholesterol',
    measure: MARKERS.TC,
    meaning: 'Cholesterol carried by every particle in the sample, free plus esterified.',
    targets: regions('chol', ALL_PARTICLES),
  },
  {
    id: 'ldl',
    name: 'LDL-C',
    measure: MARKERS.LDL,
    methods: LDL_METHODS,
    meaning:
      'Cholesterol carried in LDL particles. The lab may report it; here it is also estimated from total cholesterol, HDL-C and triglycerides by three equations. Friedewald (1972) subtracts TG ÷ 5 and is not valid at TG ≥ 400 mg/dL; Sampson (2020) stays valid up to TG 800 mg/dL; Martin-Hopkins (2013) replaces the fixed 5 with a divisor looked up from a 180-cell table. Where the estimates agree the value is solid. Targets are risk-stratified; the bands are the NCEP ATP III descriptive categories.',
    targets: ['ldl-chol'],
  },
  {
    id: 'tg',
    name: 'Triglycerides',
    measure: MARKERS.TG,
    meaning: 'Triglycerides carried by every particle in the sample; mostly VLDL when fasting, chylomicrons adding to it after a meal.',
    targets: regions('trig', ALL_PARTICLES),
  },
  {
    id: 'apob',
    name: 'ApoB',
    measure: MARKERS.APOB,
    meaning: APOB_MEANING,
    sources: APOB_SOURCES,
    targets: APOB_PILLS,
  },
  indexBadge('nonhdl', regions('chol', ['chylomicron', 'vldl', 'idl', 'ldl', 'lpa'])),
  indexBadge('remnant', regions('chol', ['chylomicron', 'vldl', 'idl'])),
  indexBadge('tchdl', regions('chol', ALL_PARTICLES)),
  indexBadge('ldlhdl', ['ldl-chol', 'hdl-chol']),
  indexBadge('aip', [...regions('trig', ALL_PARTICLES), 'hdl-chol']),
  indexBadge('apobapoa', [...APOB_PILLS, 'hdl-apo']),
];

// ---- chip cards ----

export const HMGCR = 'hmgcr';
export const HMGCR_NOTE = 'Rate-limiting enzyme of cholesterol synthesis; the target of statins.';

export const HMGCR_SOURCES: readonly CitedSource[] = [
  {
    organization: 'Endotext (Feingold KR)',
    title: 'Introduction to Lipids and Lipoproteins',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK305896/',
    year: 2024,
    retrieved: '2026-09-16',
    quote: 'HMG-CoA reductase, the rate limiting enzyme in cholesterol synthesis',
  },
  {
    organization: 'Endotext (Feingold KR)',
    title: 'Cholesterol Lowering Drugs',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK395573/',
    year: 2026,
    retrieved: '2026-09-16',
    quote: 'Statins are competitive inhibitors of HMG-CoA reductase, which leads to a decrease in cholesterol synthesis in the liver',
  },
];

export const RETENTION = 'retention';

/** Hover summary only; the gap chip carries the cited claim (RetentionCard). */
export const RETENTION_NOTE =
  'LDL, IDL and Lp(a) cross a damaged endothelium and are retained by ApoB-100 binding intima proteoglycans; particles above ~70 nm, including VLDL, mostly cannot cross this way, so no arrow is drawn from it.';

/**
 * One source (the 2020 EAS Consensus Panel review) for both the retention
 * mechanism and the ~70 nm size ceiling; VLDL sits above the ceiling, so its
 * arrow is omitted rather than drawn against an invented threshold.
 */
export const RETENTION_SOURCES: readonly CitedSource[] = [
  {
    organization: 'European Heart Journal (Borén J, Chapman MJ, Krauss RM, et al.; European Atherosclerosis Society Consensus Panel)',
    title: 'Low-density lipoproteins cause atherosclerotic cardiovascular disease: pathophysiological, genetic, and therapeutic insights',
    // SourcesBlock keys sources by title|url, so the two entries need distinct URL fragments.
    url: 'https://doi.org/10.1093/eurheartj/ehz962#retention',
    year: 2020,
    retrieved: '2026-09-17',
    quote:
      'positively charged amino acyl residues (arginine and lysine) in apoB100 with negatively charged sulfate and carboxylic acid groups of arterial wall proteoglycans',
  },
  {
    organization: 'European Heart Journal (Borén J, Chapman MJ, Krauss RM, et al.; European Atherosclerosis Society Consensus Panel)',
    title: 'Low-density lipoproteins cause atherosclerotic cardiovascular disease: pathophysiological, genetic, and therapeutic insights',
    url: 'https://doi.org/10.1093/eurheartj/ehz962#size-limit',
    year: 2020,
    retrieved: '2026-09-17',
    quote: 'Apolipoprotein B-containing lipoproteins of up to ∼70 nm in diameter […] can cross the endothelium',
  },
];
