import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  MEDICATIONS_KEY,
  addPastYear,
  addRow,
  dropUnnamed,
  emptyMedications,
  loadMedications,
  removeRow,
  saveMedications,
  toggleMonth,
  updateRow,
  type Medications,
} from '../src/data/medications';

const base = emptyMedications(2026);

describe('rows', () => {
  it('appends an empty row', () => {
    const meds = addRow(addRow(base, 'a'), 'b');
    expect(meds.rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(meds.rows[1]).toEqual({ id: 'b', name: '', dosage: '', months: [] });
    expect(base.rows).toEqual([]);
  });

  it('updates name and dosage of one row only', () => {
    const meds = updateRow(updateRow(addRow(addRow(base, 'a'), 'b'), 'a', { name: 'Metformin' }), 'a', { dosage: '500 mg' });
    expect(meds.rows[0]).toEqual({ id: 'a', name: 'Metformin', dosage: '500 mg', months: [] });
    expect(meds.rows[1].name).toBe('');
  });

  it('removes a row', () => {
    expect(removeRow(addRow(addRow(base, 'a'), 'b'), 'a').rows.map((r) => r.id)).toEqual(['b']);
  });

  it('drops rows whose name is empty or whitespace', () => {
    let meds = addRow(addRow(addRow(base, 'a'), 'b'), 'c');
    meds = updateRow(updateRow(meds, 'a', { name: 'Statin' }), 'b', { name: '   ', dosage: '10 mg' });
    expect(dropUnnamed(meds).rows.map((r) => r.id)).toEqual(['a']);
  });
});

describe('toggleMonth', () => {
  it('marks months in order and unmarks them', () => {
    let meds = addRow(base, 'a');
    meds = toggleMonth(toggleMonth(meds, 'a', '2026-03'), 'a', '2026-01');
    expect(meds.rows[0].months).toEqual(['2026-01', '2026-03']);
    expect(toggleMonth(meds, 'a', '2026-03').rows[0].months).toEqual(['2026-01']);
  });

  it('ignores a malformed month', () => {
    const meds = addRow(base, 'a');
    expect(toggleMonth(meds, 'a', '2026-13')).toBe(meds);
  });
});

describe('addPastYear', () => {
  it('adds the year before the earliest shown', () => {
    expect(addPastYear(addPastYear(base)).years).toEqual([2024, 2025, 2026]);
  });
});

describe('storage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips', () => {
    const meds: Medications = {
      years: [2025, 2026],
      rows: [{ id: 'a', name: 'Metformin', dosage: '500 mg', months: ['2025-11', '2026-03'] }],
    };
    saveMedications(meds);
    expect(loadMedications(2026)).toEqual(meds);
  });

  it('loads empty with the current year when nothing is stored', () => {
    expect(loadMedications(2026)).toEqual({ years: [2026], rows: [] });
  });

  it.each(['not json', '42', 'null', '[]', '{"years":"x","rows":{}}'])('loads %s as empty', (raw) => {
    store.set(MEDICATIONS_KEY, raw);
    expect(loadMedications(2026)).toEqual({ years: [2026], rows: [] });
  });

  it('keeps what is valid: current and marked years added, bad fields and unnamed rows dropped', () => {
    store.set(
      MEDICATIONS_KEY,
      JSON.stringify({
        years: [2020, 'x', 2020.5],
        rows: [
          { id: 'a', name: 'Statin', months: ['2023-02', 'bad', '2023-02'] },
          { id: 5, name: 'no id' },
          { id: 'b', name: '  ', months: [] },
          null,
        ],
      })
    );
    expect(loadMedications(2026)).toEqual({
      years: [2020, 2023, 2026],
      rows: [{ id: 'a', name: 'Statin', dosage: '', months: ['2023-02'] }],
    });
  });

  it('survives storage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(loadMedications(2026)).toEqual({ years: [2026], rows: [] });
    expect(() => saveMedications(base)).not.toThrow();
  });
});
