import { HELD_FILES_KEY } from '../../src/data/storage/heldFiles';

// Synthetic stand-ins for the per-report files in the data repo. Each is deliberately not what the app
// would write itself, so that any re-serialization, re-derivation or re-slugging shows up as a byte diff.

const canonical = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

export const FULL_REPORT_PATH = 'reports/2026-03-14__acme-labs.json';
export const FULL_REPORT = canonical({
  schema: '3.1',
  generatedAt: '2026-01-01T00:00:00.000Z',
  lastUpdatedDate: '2026-04-02T09:15:00.000Z',
  contentHash: `sha256:${'ab'.repeat(32)}`,
  subject: 'p-synthetic',
  sex: 'female',
  birthYear: 1980,
  notes: 'Synthetic fixture.',
  diagnosticReports: [
    {
      lab: 'Acme Labs',
      collectedAt: '2026-03-14T08:23:00+02:00',
      issuedAt: '2026-03-15T15:26:00Z',
      identifiers: { visit: 'v-1', order: 'o-2' },
      specimen: { material: 'serum', additive: 'none' },
      observations: [
        {
          loinc: '718-7',
          rawName: 'Hemoglobin ',
          value: 14.2,
          rawValue: '14.20',
          unit: 'g/L',
          rawUnit: 'g/dl',
          referenceRanges: [{ low: 12, high: 16, text: '12.0 - 16.0' }],
          interpretation: 'N',
          specimen: { material: 'whole blood' },
        },
        {
          loinc: '2345-7',
          rawName: 'Glucose',
          value: 0.01,
          comparator: '<',
          rawValue: '< 0.01',
          unit: 'mg/dL',
          method: 'Hexokinase',
        },
      ],
    },
  ],
});

// Another lab on the same day: a `-2` suffix, tab indentation, its own key order, no trailing newline.
export const SUFFIXED_REPORT_PATH = 'reports/2026-03-14__acme-labs-2.json';
export const SUFFIXED_REPORT = JSON.stringify(
  {
    diagnosticReports: [
      {
        observations: [{ rawName: 'Ferritin', loinc: '2276-4', unit: 'ng/mL', rawUnit: 'ug/L', value: 41.0 }],
        collectedAt: '2026-03-14T00:00:00Z',
        lab: 'Acme Labs',
      },
    ],
    schema: '3.1',
  },
  null,
  '\t'
);

// A non-ASCII lab name: the stored name is kept as it is, whatever the lab would slug to.
export const NON_ASCII_REPORT_PATH = 'reports/2025-11-02__unknown.json';
export const NON_ASCII_REPORT = canonical({
  schema: '3.2',
  lastUpdatedDate: '2025-11-03T10:00:00.000Z',
  diagnosticReports: [
    {
      lab: 'Ελλάδα Εργαστήριο',
      collectedAt: '2025-11-02T00:00:00Z',
      observations: [{ loinc: '2093-3', rawName: 'Χοληστερόλη', value: 186, rawValue: '186.0', unit: 'mg/dL', rawUnit: 'mg/dL' }],
    },
  ],
});

export const REPORT_FILES: Record<string, string> = {
  [FULL_REPORT_PATH]: FULL_REPORT,
  [SUFFIXED_REPORT_PATH]: SUFFIXED_REPORT,
  [NON_ASCII_REPORT_PATH]: NON_ASCII_REPORT,
};

export const MEDICATIONS = JSON.stringify(
  { rows: [{ months: ['2026-01'], id: 'm1', brand: 'Vitamin D', compounds: [], notes: '2000 IU' }], years: [2025, 2026] },
  null,
  4
);
export const SCHEDULED = JSON.stringify({ visits: [{ month: '2026-10', id: 'v1', loincs: ['2093-3'], indices: ['homair'] }] }, null, 4);
export const SETTINGS = JSON.stringify(
  { 'exploreSel:Lipids': ['ldl', 'hdl'], bloodtests_view_settings_v1: { unitSystem: 'us', sampleLimit: 'all' } },
  null,
  4
);
export const MANIFEST = JSON.stringify({ exportedAt: '2026-04-02T09:15:00.000Z', format: 'blood-tests-backup', version: 1, files: [] }, null, 4);

export const OTHER_FILES: Record<string, string> = {
  'medications.json': MEDICATIONS,
  'scheduled-visits.json': SCHEDULED,
  'settings.json': SETTINGS,
};

/** The whole data folder as the repo holds it. */
export const STORED_FOLDER: Record<string, string> = { 'manifest.json': MANIFEST, ...REPORT_FILES, ...OTHER_FILES };

export const APP = { commit: 'abc1234', builtAt: '2026-09-10T08:00:00Z' };

export const heldFilesOf = (store: Map<string, string>) => JSON.parse(store.get(HELD_FILES_KEY) ?? '{}') as { reports?: Record<string, string> };
