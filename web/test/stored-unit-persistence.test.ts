import { beforeEach, describe, expect, it } from 'vitest';
import { replaceReportFiles, settleStoredSessions } from '../src/data/importResults';
import { HELD_FILES_KEY } from '../src/data/storage/heldFiles';
import { RESULTS_STORAGE_KEY, parseStoredSessions } from '../src/data/storage/resultsStorage';
import { validateDiagnosticReports } from '../src/data/validateDiagnosticReports';
import { installMemoryStorage } from './helpers/storage';

const PATH = 'reports/2026-01-10__lab-a__ygia.json';
const file = (unit: string | undefined) =>
  JSON.stringify(
    {
      schema: '3.2',
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            {
              loinc: '786-4',
              rawName: 'MCHC',
              value: 33.4,
              rawValue: '33.4',
              rawUnit: '%',
              ...(unit && { unit }),
              referenceRanges: [{ text: '32-36' }],
            },
          ],
        },
      ],
    },
    null,
    2
  ) + '\n';

const warnings = (sessions: ReturnType<typeof parseStoredSessions>) =>
  validateDiagnosticReports(sessions).filter((i) => i.level === 'warning').map((i) => i.message);

let store: Map<string, string>;
beforeEach(() => {
  store = installMemoryStorage();
});

describe('the stored unit survives the persisted results model', () => {
  it('cloud pull -> import -> persist -> reload from storage -> validate: no warning', () => {
    const files = { [PATH]: file('g/dL') };
    expect(warnings(replaceReportFiles(files))).toEqual([]);
    const reloaded = settleStoredSessions(parseStoredSessions(localStorage.getItem(RESULTS_STORAGE_KEY)));
    expect(reloaded[0]!.items![0]).toMatchObject({ unit: '%', storedUnit: 'g/dL' });
    expect(warnings(reloaded)).toEqual([]);
  });

  it('sessions persisted by an older build (no storedUnit) are re-read from the held file on load', () => {
    replaceReportFiles({ [PATH]: file('g/dL') });
    const old = JSON.parse(store.get(RESULTS_STORAGE_KEY)!) as { items: Record<string, unknown>[] }[];
    for (const s of old) for (const item of s.items) delete item.storedUnit;
    store.set(RESULTS_STORAGE_KEY, JSON.stringify(old));
    expect(warnings(parseStoredSessions(store.get(RESULTS_STORAGE_KEY)!))).toHaveLength(1);

    const reloaded = settleStoredSessions(parseStoredSessions(store.get(RESULTS_STORAGE_KEY)!));
    expect(warnings(reloaded)).toEqual([]);
    expect(JSON.parse(store.get(RESULTS_STORAGE_KEY)!)[0].items[0].storedUnit).toBe('g/dL');
  });

  it('a stored unit that is absent still warns after reload, and the held file is untouched', () => {
    const files = { [PATH]: file(undefined) };
    replaceReportFiles(files);
    const reloaded = settleStoredSessions(parseStoredSessions(localStorage.getItem(RESULTS_STORAGE_KEY)));
    expect(warnings(reloaded)).toEqual(["Unit '%' unexpected for 786-4 (expected g/dL)"]);
    expect(JSON.parse(store.get(HELD_FILES_KEY)!).reports[PATH]).toBe(files[PATH]);
  });
});
