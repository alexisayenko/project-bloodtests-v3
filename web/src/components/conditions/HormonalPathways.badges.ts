import { indexDefOf, type CitedSource, type Measure } from './pathwayShared';

/** Hormonal Pathways' measures by name, and what the page says about each: its chip captions and its badges' prose and sources. */

export type MarkerKey = 'LH' | 'FSH' | 'T' | 'SHBG' | 'ALB' | 'E2' | 'DHT' | 'FT';
export type IndexKey = 'cft' | 'cftlh' | 'biot' | 'tlh' | 'dhtt' | 'te2';
export type MeasureKey = MarkerKey | IndexKey | 'shbgBound' | 'albBound';
export type Snapshot = Record<MeasureKey, Measure>;

export const INDEX_KEYS: readonly IndexKey[] = ['cft', 'cftlh', 'biot', 'tlh', 'dhtt', 'te2'];

export type CaptionId = 'fsh' | 'lh' | 't' | 'shbg' | 'alb' | 'shbg-t' | 'alb-t' | 'e2' | 'e2blood' | 'dht';

export interface CaptionSpec {
  /** Short face on the chip. */
  label: string;
  /** Full name heading the expanded card. */
  title: string;
  measure: MeasureKey;
  note?: string;
}

export const CAPTIONS: Readonly<Record<CaptionId, CaptionSpec>> = {
  fsh: { label: 'FSH', title: 'Follicle-Stimulating Hormone', measure: 'FSH' },
  lh: { label: 'LH', title: 'Luteinizing Hormone', measure: 'LH' },
  t: { label: 'T', title: 'Free Testosterone (calculated, Vermeulen)', measure: 'cft' },
  shbg: { label: 'SHBG', title: 'Sex Hormone-Binding Globulin', measure: 'SHBG' },
  alb: { label: 'Alb', title: 'Albumin', measure: 'ALB' },
  'shbg-t': {
    label: 'SHBG-T', title: 'SHBG-bound Testosterone', measure: 'shbgBound',
    note: 'Not bioavailable: held tightly by SHBG, released slowly.',
  },
  'alb-t': {
    label: 'Alb-T', title: 'Albumin-bound Testosterone', measure: 'albBound',
    note: 'Loosely bound, released quickly in tissue capillaries.',
  },
  e2: { label: 'E2', title: 'Estradiol', measure: 'E2' },
  e2blood: { label: 'E2', title: 'Estradiol', measure: 'E2' },
  dht: { label: 'DHT', title: 'Dihydrotestosterone', measure: 'DHT' },
};

export const isCaptionId = (id: string | null): id is CaptionId => id != null && id in CAPTIONS;

export interface Badge {
  id: string;
  name: string;
  /** Absent only when `unavailable` is set — a badge for a formula this app does not compute. */
  measure?: MeasureKey;
  meaning: string;
  low: string;
  high: string;
  caveats: string;
  /** Render a fixed placeholder instead of looking up `measure`. */
  unavailable?: boolean;
}

/** The one badge merging measured free T with both calculated estimates. */
export const FREE_T_BADGE = 'free-t';

export const BADGES: ReadonlyArray<Badge> = [
  {
    id: 'total-t', name: 'Total Testosterone', measure: 'T',
    meaning: 'The overall androgen output your body is producing, before protein binding decides how much of it is actually active.',
    low: 'Less testosterone made, or less SHBG holding it.',
    high: 'More made, or more SHBG holding it (free T may still be normal).',
    caveats: 'Peaks in the morning; SHBG changes it without changing free T.',
  },
  {
    id: 'bio-t', name: 'Bioavailable Testosterone', measure: 'biot',
    meaning: 'The androgen pool tissues can actually draw on — free plus the share loosely held by albumin, as opposed to what sits inertly locked to SHBG.',
    low: 'Less testosterone reaching tissues.',
    high: 'More reaching tissues.',
    caveats: 'Calculated; reference bands depend on sex and age.',
  },
  {
    id: FREE_T_BADGE, name: 'Free Testosterone', measure: 'cft',
    meaning: 'The unbound share (about 1–3% of total) that can actually enter cells — the androgen signal tissues have available to use. The lab may measure it directly by immunoassay, or it is calculated from total T and SHBG: by Vermeulen’s binding equation (with albumin), or by Ly & Handelsman’s purely empirical regression (no albumin term).',
    low: 'Less testosterone available to tissues.',
    high: 'More available to tissues.',
    caveats: 'Direct free-T immunoassays are lab-specific, systematically under-read and unreliable, so two assays can disagree several-fold with each other and with the calculated value, which is preferred. Against equilibrium dialysis Vermeulen’s equation runs a constant ~19% high in men (33% in women), unrelated to the patient’s own SHBG, T or albumin. Ly & Handelsman’s is an empirical regression, not a physical binding model, so it carries no mechanistic interpretation and can extrapolate to a negative, non-physiological value outside the data it was fit on (shown as “–”, never as a number); in one independent comparison against equilibrium dialysis it ran closer than Vermeulen’s equation (median ratio 1.00 vs 1.19).',
  },
  {
    id: 'tlh', name: 'T/LH', measure: 'tlh',
    meaning: 'A functional readout of Leydig-cell activity — how well the testes respond to pituitary LH drive.',
    low: 'The testes respond poorly (primary or compensated hypogonadism).',
    high: 'A strong testicular response.',
    caveats: 'LH is pulsatile, so one sample is noisy; no agreed reference range.',
  },
  {
    id: 'dhtt', name: 'DHT/T', measure: 'dhtt',
    meaning: 'How much testosterone is being converted to the more potent DHT — the androgen signal driving skin, scalp and prostate tissue.',
    low: 'Less conversion (e.g. finasteride, dutasteride).',
    high: 'More conversion.',
    caveats: 'Serum DHT understates tissue DHT; LC-MS/MS assays are more reliable.',
  },
  {
    id: 't-e2', name: 'T/E2', measure: 'te2',
    meaning: 'Aromatase enzyme activity (often due to excess body fat).',
    low: 'Excess estrogen conversion.',
    high: 'Too little estradiol for bone, libido and mood.',
    caveats: 'E2 immunoassays are unreliable at male levels; units matter.',
  },
];

/** The Free Testosterone badge cites only these, in this order, matched by title; INDEX_DEFS keeps the full list. */
export const FREE_T_SOURCE_TITLES: readonly string[] = [
  'Testosterone Therapy in Men With Hypogonadism',
  'A critical evaluation of simple methods for the estimation of free testosterone',
  'Empirical estimation of free testosterone',
];

export const FREE_T_PCT_RANGE = '1.5–3.2 %';

/** Labcorp 500726's adult male % free interval, cited as INDEX_DEFS' percentage indices cite it. */
export const FREE_T_PCT_SOURCE: CitedSource | undefined = (() => {
  const r = indexDefOf('ftpct')?.references.find((ref) => ref.url?.includes('labcorp.com/tests/500726'));
  return r && { organization: r.organization, title: r.document, url: r.url, year: r.year, retrieved: r.retrieved };
})();

export const CALCULATED_FREE_T: ReadonlyArray<readonly [IndexKey, string]> = [
  ['cft', 'Vermeulen'],
  ['cftlh', 'Ly & Handelsman'],
];
