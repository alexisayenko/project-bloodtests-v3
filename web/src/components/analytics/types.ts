import type { Result } from '../../types';

/** One biomarker's full history: every dated result recorded under a LOINC. */
export interface LoincEntry {
  loinc: string;
  results: { date: string; result: Result }[];
}

/** Host-supplied display names for a LOINC, so chart components stay catalog-agnostic. */
export interface BiomarkerNames {
  full: (loinc: string) => string | undefined;
  short: (loinc: string) => string | undefined;
}
