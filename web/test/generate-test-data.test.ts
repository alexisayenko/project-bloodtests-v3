import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTestData,
  buildTestEnvelope,
  generateTestData,
  TEST_SCHEDULE_LOINCS,
  withTestMedications,
  withTestSchedule,
} from '../src/data/generateTestData';
import { parseUploadedResults } from '../src/data/parseUpload';
import { validateDiagnosticReports } from '../src/data/validateDiagnosticReports';
import { computeIndex } from '../src/data/computedIndices';
import { INDEX_DEFS } from '../src/data/indexDefs';
import { ALIAS_TO_PRIMARY } from '../src/data/analyteCatalog';
import { LABORATORIES, LABORATORY_BY_ID, quoteSchedule } from '../src/data/labPricing';
import { MEDICATIONS_KEY, loadMedications, type Medications } from '../src/data/medications';
import { buildConditions, panelRowLoincs } from '../src/components/conditions/markers';
import { EMPTY_SCHEDULED, SCHEDULED_KEY, loadScheduled, type Scheduled } from '../src/components/conditions/scheduled';
import { MONITORING_PANELS, PANELS } from './dataFiles';
import type { DiagnosticReport, Result } from '../src/types';

const TODAY = new Date(2026, 8, 10);
const reports = generateTestData();
const issues = validateDiagnosticReports(reports);
const itemsOf = (report: DiagnosticReport): Result[] => report.items ?? [];
const byLoinc = (report: DiagnosticReport) => Object.fromEntries(itemsOf(report).map((item) => [item.loinc, item]));
const indexDef = (key: string) => INDEX_DEFS.find((def) => def.key === key)!;
const computes = (key: string, report: DiagnosticReport) => computeIndex(indexDef(key), byLoinc(report)) != null;

describe('generateTestData', () => {
  it('yields 15 reports, read through the upload parse path', () => {
    expect(buildTestEnvelope().diagnosticReports).toHaveLength(15);
    expect(reports).toHaveLength(15);
    expect(reports).toEqual(parseUploadedResults(buildTestEnvelope()));
  });

  it('spans the three priced labs plus an unpriced one, over at least four years with a gap', () => {
    const places = new Set(reports.map((r) => r.place));
    for (const lab of LABORATORIES) expect(places).toContain(lab.name);
    expect([...places].some((place) => !LABORATORIES.some((lab) => lab.name === place))).toBe(true);
    const years = [...new Set(reports.map((r) => Number(r.date.slice(0, 4))))].sort((a, b) => a - b);
    expect(years.length).toBeGreaterThanOrEqual(4);
    expect(years.some((year, i) => i > 0 && year - years[i - 1]! > 1)).toBe(true);
  });

  it('raises no validation error, and exactly one sibling-code and one unrecognized-unit warning', () => {
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([]);
    const sibling = issues.filter((issue) => issue.message.includes('is the same analyte on that scale'));
    const unmapped = issues.filter((issue) => issue.message.includes('is not in the unit tables'));
    expect(sibling).toHaveLength(1);
    expect(sibling[0]!.message).toContain('14682-9');
    expect(unmapped).toHaveLength(1);
    expect(issues).toHaveLength(2);
  });

  it('keeps a below-detection-limit comparator result', () => {
    const calcitonin = reports.flatMap(itemsOf).find((item) => item.loinc === '1992-7')!;
    expect(calcitonin).toMatchObject({ value: 2, valueQualifier: '<', rawValue: '<2.0' });
  });

  it('computes indices from inputs carried on the same draw', () => {
    for (const key of ['homair', 'tyg', 'tchdl', 'ldlhdl', 'ldlf', 'apobapoa', 'ft3ft4', 'cft', 'cortdhea', 'deritis', 'tsat']) {
      expect([key, reports.some((report) => computes(key, report))]).toEqual([key, true]);
    }
    expect(reports.some((report) => ['homair', 'tyg', 'tchdl'].every((key) => computes(key, report)))).toBe(true);
  });

  it('reports one analyte under its mass code and its molar code, with Cyrillic units', () => {
    const withCode = (loinc: string) => reports.filter((r) => itemsOf(r).some((item) => item.loinc === loinc));
    expect(withCode('2093-3').length).toBeGreaterThan(0);
    expect(withCode('14647-2').length).toBeGreaterThan(0);
    expect(reports.flatMap(itemsOf).some((item) => /[Ѐ-ӿ]/.test(item.unit))).toBe(true);
  });

  it('has a date on which two labs reported', () => {
    const labsByDate = new Map<string, Set<string>>();
    for (const r of reports) labsByDate.set(r.date, (labsByDate.get(r.date) ?? new Set()).add(r.place));
    expect([...labsByDate.values()].some((labs) => labs.size >= 2)).toBe(true);
  });

  it('samples several markers of every Monitoring Panel at least twice', () => {
    const datesByPrimary = new Map<string, Set<string>>();
    for (const r of reports) {
      for (const item of itemsOf(r)) {
        const primary = ALIAS_TO_PRIMARY[item.loinc] ?? item.loinc;
        datesByPrimary.set(primary, (datesByPrimary.get(primary) ?? new Set()).add(r.date));
      }
    }
    for (const panel of buildConditions(PANELS, {}, MONITORING_PANELS)) {
      const repeated = [...panelRowLoincs(panel.tests)].filter((loinc) => (datesByPrimary.get(loinc)?.size ?? 0) >= 2);
      expect([panel.name, repeated.length >= 3]).toEqual([panel.name, true]);
    }
  });

  it('keeps session ids stable and apart from real reports, so generating again duplicates nothing', () => {
    const ids = reports.map((r) => r.file);
    expect(new Set(ids).size).toBe(15);
    expect(ids.every((id) => /__demo-\d{2}$/.test(id))).toBe(true);
    expect(generateTestData().map((r) => r.file)).toEqual(ids);
  });
});

describe('withTestMedications', () => {
  const newId = (() => {
    let n = 0;
    return () => `id-${++n}`;
  })();

  it('adds five medications marked across last year and this year, never past today', () => {
    const meds = withTestMedications({ years: [2026], rows: [] }, TODAY, newId);
    expect(meds.years).toEqual([2025, 2026]);
    expect(meds.rows).toHaveLength(5);
    const months = meds.rows.flatMap((row) => row.months);
    expect(months.some((m) => m.startsWith('2025-'))).toBe(true);
    expect(months.some((m) => m.startsWith('2026-'))).toBe(true);
    expect(months.every((m) => m >= '2025-01' && m <= '2026-09')).toBe(true);
  });

  it('skips a name already listed and leaves a complete list untouched', () => {
    const real = { id: 'real', name: ' metformin', dosage: '850 mg', months: ['2026-01'] };
    const once = withTestMedications({ years: [2026], rows: [real] }, TODAY, newId);
    expect(once.rows).toHaveLength(5);
    expect(once.rows[0]).toBe(real);
    expect(withTestMedications(once, TODAY, newId)).toBe(once);
  });
});

describe('withTestSchedule', () => {
  it('seeds an empty schedule for next month, priced unevenly across the labs', () => {
    const seeded = withTestSchedule({ ...EMPTY_SCHEDULED }, TODAY);
    expect(seeded.month).toBe('2026-10');
    expect(seeded.loincs).toEqual(expect.arrayContaining(TEST_SCHEDULE_LOINCS));
    expect(seeded.indices).toEqual(expect.arrayContaining(['homair', 'tyg', 'tchdl']));
    const esculab = quoteSchedule(seeded.loincs, LABORATORY_BY_ID.esculab!);
    expect(esculab.unpriced).toEqual(expect.arrayContaining(['4548-4', '20448-7', '11580-8']));
    expect(esculab.charged.filter((line) => line.label === 'FBC')).toHaveLength(1);
    expect(quoteSchedule(seeded.loincs, LABORATORY_BY_ID.synevo!).unpriced).toEqual(['11580-8']);
  });

  it('keeps a month already chosen', () => {
    expect(withTestSchedule({ ...EMPTY_SCHEDULED, month: '2027-03' }, TODAY).month).toBe('2027-03');
  });

  it('returns a non-empty schedule untouched', () => {
    const scheduled: Scheduled = { loincs: ['1742-6'], indices: [] };
    expect(withTestSchedule(scheduled, TODAY)).toBe(scheduled);
  });
});

describe('applyTestData', () => {
  const store = new Map<string, string>();
  let sessions: DiagnosticReport[] = [];
  const merge = (groups: DiagnosticReport[]) => {
    const byFile = new Map(sessions.map((g) => [g.file, g]));
    for (const g of groups) byFile.set(g.file, g);
    sessions = [...byFile.values()];
  };

  beforeEach(() => {
    store.clear();
    sessions = [];
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('merges the reports and seeds medications and a schedule, and running again duplicates nothing', () => {
    applyTestData(merge, TODAY);
    applyTestData(merge, TODAY);
    expect(sessions).toHaveLength(15);
    expect(loadMedications(2026).rows).toHaveLength(5);
    expect(loadScheduled().loincs).toEqual(expect.arrayContaining(TEST_SCHEDULE_LOINCS));
  });

  it('never rewrites a non-empty schedule or a medication list that already has every name', () => {
    const scheduled = JSON.stringify({ loincs: ['1742-6'], indices: [], month: '2026-12' });
    store.set(SCHEDULED_KEY, scheduled);
    applyTestData(merge, TODAY);
    const meds = store.get(MEDICATIONS_KEY)!;
    expect((JSON.parse(meds) as Medications).rows).toHaveLength(5);
    applyTestData(merge, TODAY);
    expect(store.get(SCHEDULED_KEY)).toBe(scheduled);
    expect(store.get(MEDICATIONS_KEY)).toBe(meds);
  });
});
