import { describe, it, expect } from 'vitest';
import { parseStoredSessions } from '../src/data/resultsStorage';

const item = {
  loinc: '718-7',
  section: '',
  value: 14.2,
  rawValue: '14.2',
  valueQualifier: '',
  unit: 'g/dL',
  refText: '',
  refMin: null,
  refMax: null,
  method: '',
};

const session = (items: unknown[]) => ({ date: '2026-01-10', place: 'Lab A', file: '2026-01-10__lab-a', items, itemCount: items.length });

describe('parseStoredSessions', () => {
  it('reads an old-shape stored session, taking `analysis` as the printed name', () => {
    const raw = JSON.stringify([session([{ ...item, analysis: 'Гемоглобин', symbol: '' }])]);
    const [loaded] = parseStoredSessions(raw);
    expect(loaded!.items![0]).toEqual({ ...item, rawName: 'Гемоглобин' });
    expect(loaded!.items![0]).not.toHaveProperty('analysis');
    expect(loaded!.items![0]).not.toHaveProperty('symbol');
  });

  it('keeps a current-shape session as stored', () => {
    const current = session([{ ...item, rawName: 'Hemoglobin' }]);
    expect(parseStoredSessions(JSON.stringify([current]))).toEqual([current]);
  });

  it('prefers rawName when a result carries both names', () => {
    const [loaded] = parseStoredSessions(JSON.stringify([session([{ ...item, rawName: 'HGB', analysis: 'Hemoglobin' }])]));
    expect(loaded!.items![0]!.rawName).toBe('HGB');
  });

  it('reads nothing from empty, non-array or corrupt storage', () => {
    expect(parseStoredSessions(null)).toEqual([]);
    expect(parseStoredSessions('{"not":"sessions"}')).toEqual([]);
    expect(parseStoredSessions('{not json')).toEqual([]);
  });
});
