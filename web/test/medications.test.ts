import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  MEDICATIONS_KEY,
  addCompound,
  addPastYear,
  addRow,
  dropUnnamed,
  emptyMedications,
  loadMedications,
  removeCompound,
  removeRow,
  saveMedications,
  toggleMonth,
  updateCompound,
  updateRow,
  type Medications,
} from '../src/data/medications';

const base = emptyMedications(2026);

describe('rows', () => {
  it('appends an empty row', () => {
    const meds = addRow(addRow(base, 'a'), 'b');
    expect(meds.rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(meds.rows[1]).toEqual({ id: 'b', brand: '', compounds: [], notes: '', months: [] });
    expect(base.rows).toEqual([]);
  });

  it('updates brand and notes of one row only', () => {
    const meds = updateRow(updateRow(addRow(addRow(base, 'a'), 'b'), 'a', { brand: 'Metformin' }), 'a', { notes: 'evening' });
    expect(meds.rows[0]).toEqual({ id: 'a', brand: 'Metformin', compounds: [], notes: 'evening', months: [] });
    expect(meds.rows[1].brand).toBe('');
  });

  it('removes a row', () => {
    expect(removeRow(addRow(addRow(base, 'a'), 'b'), 'a').rows.map((r) => r.id)).toEqual(['b']);
  });

  it('drops rows whose brand is empty or whitespace', () => {
    let meds = addRow(addRow(addRow(base, 'a'), 'b'), 'c');
    meds = updateRow(updateRow(meds, 'a', { brand: 'Statin' }), 'b', { brand: '   ', notes: '10 mg' });
    expect(dropUnnamed(meds).rows.map((r) => r.id)).toEqual(['a']);
  });
});

describe('compounds', () => {
  it('adds, updates and removes a compound on one row only', () => {
    let meds = addRow(addRow(base, 'a'), 'b');
    meds = addCompound(meds, 'a');
    expect(meds.rows[0].compounds).toEqual([{ name: '', dose: '' }]);
    expect(meds.rows[1].compounds).toEqual([]);

    meds = updateCompound(meds, 'a', 0, { name: 'valsartan', dose: '80mg' });
    meds = addCompound(meds, 'a');
    meds = updateCompound(meds, 'a', 1, { name: 'Hydrochlorothiazide', dose: '12.5mg' });
    expect(meds.rows[0].compounds).toEqual([
      { name: 'valsartan', dose: '80mg' },
      { name: 'Hydrochlorothiazide', dose: '12.5mg' },
    ]);

    meds = removeCompound(meds, 'a', 0);
    expect(meds.rows[0].compounds).toEqual([{ name: 'Hydrochlorothiazide', dose: '12.5mg' }]);
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
      rows: [
        {
          id: 'a',
          brand: 'Вальсакор Н80',
          compounds: [
            { name: 'valsartan', dose: '80mg' },
            { name: 'Hydrochlorothiazide', dose: '12.5mg' },
          ],
          notes: 'вечором',
          months: ['2025-11', '2026-03'],
        },
      ],
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
          { id: 'a', brand: 'Statin', months: ['2023-02', 'bad', '2023-02'] },
          { id: 5, brand: 'no id' },
          { id: 'b', brand: '  ', months: [] },
          null,
        ],
      })
    );
    expect(loadMedications(2026)).toEqual({
      years: [2020, 2023, 2026],
      rows: [{ id: 'a', brand: 'Statin', compounds: [], notes: '', months: ['2023-02'] }],
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

  describe('migration from the pre-redesign name/dosage shape', () => {
    it('migrates name to brand and dosage to notes losslessly, with empty compounds', () => {
      store.set(
        MEDICATIONS_KEY,
        JSON.stringify({
          years: [2025, 2026],
          rows: [
            {
              id: 'a',
              name: 'Вальсакор Н80 (валсартан + гідрохлортіазид)',
              dosage: '80 + 12,5 мг, вечером',
              months: ['2026-01'],
            },
            { id: 'b', name: 'Магній гліцинат', dosage: '', months: [] },
          ],
        })
      );

      expect(loadMedications(2026)).toEqual({
        years: [2025, 2026],
        rows: [
          {
            id: 'a',
            brand: 'Вальсакор Н80 (валсартан + гідрохлортіазид)',
            compounds: [],
            notes: '80 + 12,5 мг, вечером',
            months: ['2026-01'],
          },
          { id: 'b', brand: 'Магній гліцинат', compounds: [], notes: '', months: [] },
        ],
      });
    });

    it('never invents a dose split or a compound entry out of the old free-text fields', () => {
      store.set(
        MEDICATIONS_KEY,
        JSON.stringify({ years: [2026], rows: [{ id: 'a', name: 'Combo (a + b)', dosage: '10 + 20 mg', months: [] }] })
      );
      expect(loadMedications(2026).rows[0].compounds).toEqual([]);
    });

    it('round-trips an already-migrated row unchanged (brand takes precedence over a stray legacy name)', () => {
      store.set(
        MEDICATIONS_KEY,
        JSON.stringify({
          years: [2026],
          rows: [{ id: 'a', brand: 'New shape', name: 'stale legacy name', compounds: [{ name: 'x', dose: '1mg' }], notes: 'daily', months: [] }],
        })
      );
      expect(loadMedications(2026).rows[0]).toEqual({
        id: 'a',
        brand: 'New shape',
        compounds: [{ name: 'x', dose: '1mg' }],
        notes: 'daily',
        months: [],
      });
    });

    it('drops a migrated row whose old name was empty or whitespace, same as a new-shape row', () => {
      store.set(
        MEDICATIONS_KEY,
        JSON.stringify({ years: [2026], rows: [{ id: 'a', name: '   ', dosage: 'once daily', months: [] }] })
      );
      expect(loadMedications(2026).rows).toEqual([]);
    });
  });
});
