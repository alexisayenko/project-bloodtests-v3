import type { Observation } from '../../src/components/conditions/markers';
import type { ResultEntry } from '../../src/components/conditions/resultsLookup';
import type { DiagnosticReport, Result } from '../../src/types';

export const makeResult = (overrides: Partial<Result> = {}): Result => {
  const value = overrides.value ?? null;
  return {
    loinc: '',
    rawName: '',
    section: '',
    value,
    rawValue: value == null ? '' : String(value),
    valueQualifier: '',
    unit: '',
    refText: '',
    refMin: null,
    refMax: null,
    method: '',
    ...overrides,
  };
};

export type EntryOverrides = Partial<Omit<ResultEntry, 'result'>> & { result?: Partial<Result> };

export const makeEntry = ({ loinc = '', date = '2026-01-01', place = 'Lab', result = {} }: EntryOverrides = {}): ResultEntry => ({
  loinc,
  date,
  place,
  result: makeResult({ loinc, ...result }),
});

export const makeObservation = (overrides: Partial<Observation> = {}): Observation => {
  const loinc = overrides.loinc ?? '';
  const shortName = overrides.shortName ?? loinc;
  return { loinc, shortName, friendlyName: shortName, longCommonName: '', ...overrides };
};

export interface EnvelopeObservation {
  loinc?: string;
  rawName: string;
  value?: number | string | null;
  unit?: string;
  [key: string]: unknown;
}

export interface EnvelopeReport {
  lab: string;
  collectedAt: string;
  observations: EnvelopeObservation[];
  [key: string]: unknown;
}

export const makeReport = (overrides: Partial<EnvelopeReport> = {}): EnvelopeReport => ({
  lab: 'Lab A',
  collectedAt: '2026-01-10T00:00:00Z',
  observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2 }],
  ...overrides,
});

export const makeEnvelope = (...reports: EnvelopeReport[]) => ({ schema: 3, diagnosticReports: reports });

export const makeSession = (overrides: Partial<DiagnosticReport> = {}): DiagnosticReport => {
  const items = overrides.items === undefined ? [] : overrides.items;
  return {
    date: '2026-08-26',
    place: 'Quest',
    file: 'quest_2026-08-26',
    items,
    itemCount: items?.length ?? 0,
    ...overrides,
  };
};
