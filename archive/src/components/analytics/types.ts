import type { Result } from '../../types';

/** One biomarker's full history: every dated result recorded under a LOINC. */
export interface LoincEntry {
  loinc: string;
  results: { date: string; result: Result }[];
}

/** Host-supplied names for a LOINC, so chart components stay catalog-agnostic. */
export interface BiomarkerNames {
  friendlyName: (loinc: string) => string | undefined;
  shortName: (loinc: string) => string | undefined;
}
