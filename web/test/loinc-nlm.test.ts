import { describe, it, expect } from 'vitest';
import { selectByUnit } from '../src/data/loincNlm';

describe('selectByUnit', () => {
  const entries = [
    { loinc: '15081-3', name: 'Prolactin [Units/vol]', unit: 'mIU/L' },
    { loinc: '2842-3', name: 'Prolactin [Mass/vol]', unit: 'ng/mL;ug/L' },
    { loinc: '20568-2', name: 'Prolactin panel', unit: undefined },
  ];

  it('puts unit-agreeing entries first and drops contradicting ones', () => {
    expect(selectByUnit(entries, 'ng/mL').map((e) => e.loinc)).toEqual(['2842-3', '20568-2']);
  });

  it('matches any unit in a semicolon-separated list', () => {
    expect(selectByUnit(entries, 'μg/L')[0]?.loinc).toBe('2842-3');
  });

  it('returns entries unchanged when the row has no unit', () => {
    expect(selectByUnit(entries, undefined)).toEqual(entries);
  });

  it('returns entries unchanged when nothing agrees', () => {
    expect(selectByUnit(entries, 'mmol/L')).toEqual(entries);
  });
});
