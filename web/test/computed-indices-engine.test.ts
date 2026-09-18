import { describe, it, expect } from 'vitest';
import { MARKER_CANDIDATE_LOINCS, MARKER_LOINC, computeIndex, convertUnit, indexZone, markersForIndex, zone } from '../src/data/computedIndices';
import { INDEX_DEFS } from '../src/data/indexDefs';
import type { Result } from '../src/types';
import { GOLD, r } from './fixtures/v2-golden-master';

describe('molar-coded readings reach the same index as their mass primary', () => {
  // Every reading of RESULTS that has a [Moles/volume] sibling in the catalog,
  // restated under that sibling's LOINC and unit. A history from a lab that
  // reports in mmol/L looks like this, and before alias resolution not one of
  // these indices computed at all.
  const MOLAR: Record<string, Result> = Object.fromEntries([
    r('14647-2', convertUnit(200, 'TC', 'mg/dL', 'mmol/L')!, 'mmol/L'), // TC
    r('14646-4', convertUnit(50, 'HDL-C', 'mg/dL', 'mmol/L')!, 'mmol/L'), // HDL-C
    r('22748-8', convertUnit(120, 'LDL-C', 'mg/dL', 'mmol/L')!, 'mmol/L'), // LDL-C
    r('14927-8', convertUnit(150, 'TRIG', 'mg/dL', 'mmol/L')!, 'mmol/L'), // TRIG
    r('15074-8', convertUnit(95, 'GLU', 'mg/dL', 'mmol/L')!, 'ммоль/л'), // GLU, as printed
    r('20448-7', 8, 'uIU/mL'), // Insulin
  ]);

  const ALIAS_FED = ['ka', 'tchdl', 'ldlhdl', 'aip', 'nonhdl', 'remnant', 'vldl', 'ldlf', 'ldls', 'ldlmh', 'tyg', 'gi', 'homair', 'homab'];

  for (const key of ALIAS_FED) {
    it(`${key} computes the mass-coded value from molar codes alone`, () => {
      const def = INDEX_DEFS.find((d) => d.key === key)!;
      const v = def.fn(markersForIndex(def, MOLAR));
      expect(v).not.toBeNull();
      expect(v!).toBeCloseTo(GOLD[key]!, 5);
    });
  }

  it('takes the candidate codes from the catalog, not a second hand-written list', () => {
    // 14647-2 is `aliasOf` 2093-3 in analyses.json and appears nowhere in
    // MARKER_LOINC; reaching it can only be the derived expansion.
    expect(MARKER_LOINC['TC']).not.toContain('14647-2');
    expect(MARKER_CANDIDATE_LOINCS['TC']).toContain('14647-2');
    expect(MARKER_CANDIDATE_LOINCS['TC']![0]).toBe('2093-3');
    expect(MARKER_CANDIDATE_LOINCS['GLU']).toEqual(expect.arrayContaining(['2339-0', '2345-7', '15074-8']));
  });

  it('prefers a declared code over an alias when the draw carries both', () => {
    const both = { ...MOLAR, ...Object.fromEntries([r('2093-3', 260, 'mg/dL'), r('2085-9', 50, 'mg/dL')]) };
    const tchdl = INDEX_DEFS.find((d) => d.key === 'tchdl')!;
    expect(markersForIndex(tchdl, both)['TC']).toBeCloseTo(260, 6);
  });

  it('puts both sides of a unit-free ratio on one scale', () => {
    // TC molar, HDL mass: the raw numbers differ by ~38.7x, so an unconverted
    // ratio would read ~0.1 instead of 4.
    const mixed = Object.fromEntries([
      r('14647-2', convertUnit(200, 'TC', 'mg/dL', 'mmol/L')!, 'mmol/L'),
      r('2085-9', 50, 'mg/dL'),
    ]);
    const tchdl = INDEX_DEFS.find((d) => d.key === 'tchdl')!;
    expect(computeIndex(tchdl, mixed)).toBeCloseTo(4, 5);
  });

  it('converts an apolipoprotein printed in g/L, as Russian-language labs do', () => {
    const apobapoa = INDEX_DEFS.find((d) => d.key === 'apobapoa')!;
    const gPerL = Object.fromEntries([r('1884-6', 0.9, 'g/L'), r('1869-7', 1.3, 'г/л')]);
    expect(apobapoa.fn(markersForIndex(apobapoa, gPerL))!).toBeCloseTo(GOLD['apobapoa']!, 5);
  });
});

describe('an alias-coded reading that cannot be placed declines rather than guesses', () => {
  it('omits a molar DHT (15057-3, nmol/L): no verified nmol/L -> ng/dL rule for DHT', () => {
    const dhtt = INDEX_DEFS.find((d) => d.key === 'dhtt')!;
    const molarDht = Object.fromEntries([r('15057-3', 1.4, 'nmol/L'), r('14913-8', 17.335, 'nmol/L')]);
    const m = markersForIndex(dhtt, molarDht);
    expect(m['DHT']).toBeUndefined();
    expect(m['T']).toBeCloseTo(500, 0);
    expect(computeIndex(dhtt, molarDht)).toBeNull();
  });

  it('omits a molar glucose whose printed unit is not a unit at all', () => {
    const homair = INDEX_DEFS.find((d) => d.key === 'homair')!;
    const junk = Object.fromEntries([r('15074-8', 5.27, 'per widget'), r('20448-7', 8, 'uIU/mL')]);
    expect(markersForIndex(homair, junk)['GLU']).toBeUndefined();
    expect(computeIndex(homair, junk)).toBeNull();
  });
});

describe('zone (3-band coloring, ported from v2 flag tests)', () => {
  it('lower-is-better: ok below good, warn between, bad above warn', () => {
    expect(zone(1.9, 2, 2.9)).toBe('ok');
    expect(zone(2.5, 2, 2.9)).toBe('warn');
    expect(zone(3.5, 2, 2.9)).toBe('bad');
  });

  it('higher-is-better: ok at/above good, warn between, bad below warn', () => {
    expect(zone(110, 100, 65, true)).toBe('ok');
    expect(zone(100, 100, 65, true)).toBe('ok'); // boundary: >= good
    expect(zone(80, 100, 65, true)).toBe('warn');
    expect(zone(50, 100, 65, true)).toBe('bad');
  });

  // The testosterone fractions have no sourced band that fits the three-zone model, and carry none on purpose.
  const UNBANDED = new Set(['cftpct', 'ftpct', 'cftlhpct', 'biotpct']);

  it('every other index has a band to judge by: fixed cut-points or bands by sex', () => {
    for (const def of INDEX_DEFS) {
      expect(def.cut != null || def.bandsBySex != null, def.key).toBe(!UNBANDED.has(def.key));
    }
  });

  it('an index without bands by sex ignores the profile', () => {
    const tchdl = INDEX_DEFS.find((d) => d.key === 'tchdl')!;
    for (const sex of [undefined, 'male', 'female'] as const) expect(indexZone(tchdl, 4, { sex })).toBe(zone(4, 3.5, 5));
  });
});

describe('convertUnit', () => {
  it('folds a printed spelling to its Latin form before matching a rule', () => {
    // Without the fold "ммоль/л" matched nothing and the value came back
    // untouched -- while the display went on labelling it mg/dL.
    expect(convertUnit(5.2, 'TC', 'ммоль/л', 'mg/dL')).toBeCloseTo(5.2 * 38.6664, 2);
    expect(convertUnit(5.2, 'TC', 'ммоль/л', 'mmol/L')).toBe(5.2);
  });

  it('is undefined when no verified conversion covers the pair', () => {
    expect(convertUnit(2, 'TC', 'g/L', 'mg/dL')).toBeUndefined();
    expect(convertUnit(2, 'TC', '', 'mg/dL')).toBeUndefined();
    expect(convertUnit(40, 'SHBG', 'ug/mL', 'nmol/L')).toBeUndefined();
  });

  it('rescales a same-dimension pair in both directions, the reverse not a copy of the forward', () => {
    expect(convertUnit(5, 'T', 'ng/mL', 'ng/dL')).toBeCloseTo(500, 10);
    expect(convertUnit(500, 'T', 'ng/dL', 'ng/mL')).toBeCloseTo(5, 10);
    expect(convertUnit(0.9, 'ApoB', 'g/L', 'mg/dL')).toBeCloseTo(90, 10);
    expect(convertUnit(90, 'ApoB', 'mg/dL', 'g/L')).toBeCloseTo(0.9, 10);
    expect(convertUnit(130, 'ApoA1', 'mg/dL', 'g/L')).toBeCloseTo(1.3, 10);
    expect(convertUnit(5, 'T', 'ng/mL', 'nmol/L')).toBeCloseTo(17.33517, 5);
    expect(convertUnit(17.33517, 'T', 'nmol/L', 'ng/mL')).toBeCloseTo(5, 5);
  });
});

describe('markersForIndex — inputs that cannot reach the formula\'s unit', () => {
  const fai = INDEX_DEFS.find((d) => d.key === 'fai')!;

  it('leaves out an input no conversion can place in the expected unit', () => {
    // SHBG printed in ug/mL under its mass code: there is no ug/mL -> nmol/L
    // rule, and feeding the number in raw would compute FAI on the wrong scale.
    const m = markersForIndex(fai, Object.fromEntries([r('2942-1', 4, 'ug/mL')]));
    expect(m['SHBG']).toBeUndefined();
  });

  it('still converts an input whose printed unit only differs in spelling', () => {
    // tlh wants testosterone in ng/dL; the reading is molar, spelled Cyrillic.
    const tlh = INDEX_DEFS.find((d) => d.key === 'tlh')!;
    const m = markersForIndex(tlh, Object.fromEntries([r('14913-8', 17.335, 'нмоль/л')]));
    expect(m['T']).toBeCloseTo(500, 0);
  });
});
