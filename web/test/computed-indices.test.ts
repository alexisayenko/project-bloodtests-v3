import { describe, it, expect } from 'vitest';
import {
  MARKER_CANDIDATE_LOINCS,
  MARKER_LOINC,
  computeIndex,
  convertUnit,
  markersForIndex,
  zone,
} from '../src/data/computedIndices';
import { INDEX_DEFS } from '../src/data/indexDefs';
import type { Result } from '../src/types';

/**
 * Golden-master for all derived indices, ported from
 * project-bloodtests-v2 engine/test/indices.test.ts. Expected values are the
 * v2 GOLD constants, re-baselined where noted on GOLD below; v3 drops the
 * age/sex indices (eGFR ×3, FIB-4), so those golds are omitted.
 *
 * Unlike v2's test (which normalized units by hand before calling fn), this
 * fixture is Result objects with real LOINCs and units, so the assertion
 * exercises v3's own pipeline: findResult's LOINC candidates → toUnit
 * normalization → fn. Testosterone is deliberately given in nmol/L (the molar
 * LOINC 14913-8) to prove the nmol/L → ng/dL conversion feeds the formulas.
 */

function r(loinc: string, value: number, unit: string): [string, Result] {
  return [
    loinc,
    {
      loinc,
      rawName: '',
            section: '',
      value,
      rawValue: String(value),
      valueQualifier: '',
      unit,
      refText: '',
      refMin: null,
      refMax: null,
      method: '',
    },
  ];
}

// Alex's fixture from v2, US units — except T, stored molar as labs report it.
const RESULTS: Record<string, Result> = Object.fromEntries([
  r('2093-3', 200, 'mg/dL'), // TC
  r('2085-9', 50, 'mg/dL'), // HDL-C
  r('13457-7', 120, 'mg/dL'), // LDL-C
  r('2571-8', 150, 'mg/dL'), // TRIG
  r('1884-6', 90, 'mg/dL'), // ApoB
  r('1869-7', 130, 'mg/dL'), // ApoA1
  r('2339-0', 95, 'mg/dL'), // GLU
  r('20448-7', 8, 'uIU/mL'), // Insulin
  r('14913-8', 17.335, 'nmol/L'), // T — 500 ng/dL, molar
  r('2942-1', 40, 'nmol/L'), // SHBG
  r('1751-7', 4.3, 'g/dL'), // ALB
  r('10501-5', 5, 'mIU/mL'), // LH
  r('2243-4', 30, 'pg/mL'), // E2
  r('1848-1', 400, 'pg/mL'), // DHT
  r('2143-6', 15, 'mcg/dL'), // Cortisol
  r('2191-5', 250, 'mcg/dL'), // DHEA-S
  r('3051-0', 3.1, 'pg/mL'), // FT3
  r('3024-7', 1.3, 'ng/dL'), // FT4
  r('1920-8', 25, 'U/L'), // AST
  r('1742-6', 20, 'U/L'), // ALT
  r('2498-4', 100, 'mcg/dL'), // Fe
  r('2500-7', 350, 'mcg/dL'), // TIBC
]);

// v2 GOLD, minus the unported age/sex indices (egfr, egfrcys, egfrcrcys, fib4).
//
// Re-baselined off v2 when the mass<->molar conversion constants stopped being
// hand-typed and became derived from cited molar masses (molar-masses.json):
// several hand-typed constants were slightly imprecise. The shift is <=0.07%
// relative and moves no value the UI displays at 2dp — a constants correction,
// not a change in any formula.
const GOLD: Record<string, number> = {
  ka: 3,
  tchdl: 4,
  ldlhdl: 2.4,
  aip: 0.117289,
  nonhdl: 150,
  remnant: 30,
  vldl: 30,
  ldlf: 120,
  ldls: 123.397291,
  apobapoa: 0.692308,
  tyg: 8.871365,
  gi: 11.875,
  homair: 1.874918,
  homab: 90.231958,
  cft: 93.162473,
  fai: 43.3375,
  tlh: 99.999028,
  te2: 16.666505,
  dhtt: 8.000078,
  cortdhea: 0.060995,
  ft3ft4: 0.284579,
  deritis: 1.25,
  tsat: 28.571429,
};

describe('computed indices — golden master (v2 parity)', () => {
  it('covers every ported index', () => {
    expect(Object.keys(GOLD).sort()).toEqual(INDEX_DEFS.map((d) => d.key).sort());
  });

  for (const def of INDEX_DEFS) {
    it(`${def.key} = ${GOLD[def.key]}`, () => {
      const v = def.fn(markersForIndex(def, RESULTS));
      expect(v).not.toBeNull();
      expect(v!).toBeCloseTo(GOLD[def.key]!, 5);
    });
  }

  it('computeIndex quantizes to 2dp for display', () => {
    const aip = INDEX_DEFS.find((d) => d.key === 'aip')!;
    expect(computeIndex(aip, RESULTS)).toBeCloseTo(0.12, 10);
  });

  it('returns null when an input marker is missing', () => {
    const homair = INDEX_DEFS.find((d) => d.key === 'homair')!;
    const withoutInsulin = Object.fromEntries(Object.entries(RESULTS).filter(([k]) => k !== '20448-7'));
    expect(computeIndex(homair, withoutInsulin)).toBeNull();
  });

  it('falls back to alias LOINCs (T reported as 2986-8 ng/mL)', () => {
    const tlh = INDEX_DEFS.find((d) => d.key === 'tlh')!;
    const rest = Object.fromEntries(Object.entries(RESULTS).filter(([k]) => k !== '14913-8'));
    const withAliasT: Record<string, Result> = { ...rest, ...Object.fromEntries([r('2986-8', 5, 'ng/mL')]) };
    // 5 ng/mL = 500 ng/dL → T/LH = 100
    expect(computeIndex(tlh, withAliasT)).toBeCloseTo(100, 5);
  });

  // Insulin is an arbitrary-unit analyte, so the "µU/mL" nine of the owner's
  // fourteen draws are printed in is the same unit as the "µIU/mL" of the other
  // five. Every insulin-dependent index must read it identically.
  it('reads insulin printed µU/mL exactly as µIU/mL', () => {
    const asU: Record<string, Result> = { ...RESULTS, ...Object.fromEntries([r('20448-7', 8, 'µU/mL')]) };
    for (const key of ['homair', 'homab', 'gi']) {
      const def = INDEX_DEFS.find((d) => d.key === key)!;
      expect(markersForIndex(def, asU)['Insulin']).toBe(8);
      expect([key, computeIndex(def, asU)]).toEqual([key, computeIndex(def, RESULTS)]);
    }
  });
});

describe('calculatedFreeTestosterone via the cft index (Vermeulen golden master)', () => {
  const cft = INDEX_DEFS.find((d) => d.key === 'cft')!;
  const fixture = (t_ngdl: number, shbg: number, alb?: number) => {
    const m: Record<string, number | undefined> = { T: t_ngdl, SHBG: shbg };
    if (alb != null) m['ALB'] = alb;
    return m;
  };

  it('sanity example (total 888 ng/dL)', () => {
    expect(cft.fn(fixture(888, 30, 4.3))!).toBeCloseTo(219.401605, 5);
  });

  it('mid case', () => {
    expect(cft.fn(fixture(500, 40, 4.5))!).toBeCloseTo(91.114944, 5);
  });

  it('albumin defaults to 4.3 when omitted', () => {
    expect(cft.fn(fixture(300, 60))!).toBeCloseTo(39.353986, 5);
  });

  it('matches the ISSAM reference calculator (T 446, SHBG 24.9, ALB 4.3 → ~2.41%)', () => {
    const ft = cft.fn(fixture(446, 24.9, 4.3))!;
    const pct = (ft / 10 / 446) * 100;
    expect(pct).toBeCloseTo(2.41, 1);
  });
});

describe('fai (free androgen index)', () => {
  const fai = INDEX_DEFS.find((d) => d.key === 'fai')!;

  it('known pair: T 20 nmol/L, SHBG 40 nmol/L -> FAI 50', () => {
    expect(fai.fn({ T: 20, SHBG: 40 })).toBeCloseTo(50, 5);
  });

  it('known pair: T 10 nmol/L, SHBG 25 nmol/L -> FAI 40', () => {
    expect(fai.fn({ T: 10, SHBG: 25 })).toBeCloseTo(40, 5);
  });

  it('returns null when SHBG is missing', () => {
    expect(fai.fn({ T: 20 })).toBeNull();
  });

  it('returns null when T is missing', () => {
    expect(fai.fn({ SHBG: 40 })).toBeNull();
  });
});

describe('LDL-C estimates (Friedewald 1972 / Sampson NIH-2 2020)', () => {
  const ldlf = INDEX_DEFS.find((d) => d.key === 'ldlf')!;
  const ldls = INDEX_DEFS.find((d) => d.key === 'ldls')!;
  const m = (TC: number, hdl: number, TRIG: number) => ({ TC, 'HDL-C': hdl, TRIG });

  it('Friedewald: TC 200, HDL 50, TG 150 -> 200 − 50 − 30 = 120', () => {
    expect(ldlf.fn(m(200, 50, 150))).toBeCloseTo(120, 10);
  });

  it('Friedewald: TC 250, HDL 40, TG 300 -> 250 − 40 − 60 = 150', () => {
    expect(ldlf.fn(m(250, 40, 300))).toBeCloseTo(150, 10);
  });

  it('Sampson: TC 200, HDL 50, TG 150 -> 123.397291', () => {
    // 200/0.948 = 210.970464; 50/0.971 = 51.493306; nonHDL = 150;
    // 150/8.56 = 17.523364; 150×150/2140 = 10.514019; 150²/16100 = 1.397516
    // 210.970464 − 51.493306 − (17.523364 + 10.514019 − 1.397516) − 9.44
    expect(ldls.fn(m(200, 50, 150))).toBeCloseTo(123.397291, 5);
  });

  it('Sampson: TC 250, HDL 40, TG 300 -> 154.182516', () => {
    // 250/0.948 = 263.713080; 40/0.971 = 41.194645; nonHDL = 210;
    // 300/8.56 = 35.046729; 300×210/2140 = 29.439252; 300²/16100 = 5.590062
    expect(ldls.fn(m(250, 40, 300))).toBeCloseTo(154.182516, 5);
  });

  it('Friedewald is suppressed at or above TG 400 mg/dL, Sampson still computes', () => {
    expect(ldlf.fn(m(240, 45, 400))).toBeNull();
    expect(ldlf.fn(m(240, 45, 399))).toBeCloseTo(240 - 45 - 399 / 5, 10);
    expect(ldls.fn(m(240, 45, 400))).not.toBeNull();
  });

  it('Sampson is suppressed above TG 800 mg/dL, its validated ceiling', () => {
    expect(ldls.fn(m(300, 40, 801))).toBeNull();
    expect(ldls.fn(m(300, 40, 800))).not.toBeNull();
  });

  it('both return null when an input is missing', () => {
    expect(ldlf.fn({ TC: 200, 'HDL-C': 50 })).toBeNull();
    expect(ldls.fn({ TC: 200, TRIG: 150 })).toBeNull();
  });

  it('mmol/L inputs go through the mg/dL conversion, not a raw /5', () => {
    // The mg/dL fixture restated in mmol/L; feeding those numbers to a /5 term
    // unconverted would be a ~2.3x error (the mmol/L form of Friedewald is /2.2).
    const si = Object.fromEntries([
      r('2093-3', convertUnit(200, 'TC', 'mg/dL', 'mmol/L')!, 'mmol/L'),
      r('2085-9', convertUnit(50, 'HDL-C', 'mg/dL', 'mmol/L')!, 'mmol/L'),
      r('2571-8', convertUnit(150, 'TRIG', 'mg/dL', 'mmol/L')!, 'mmol/L'),
    ]);
    expect(ldlf.fn(markersForIndex(ldlf, si))!).toBeCloseTo(120, 6);
    expect(ldls.fn(markersForIndex(ldls, si))!).toBeCloseTo(123.397291, 5);
  });
});

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

  const ALIAS_FED = ['ka', 'tchdl', 'ldlhdl', 'aip', 'nonhdl', 'remnant', 'vldl', 'ldlf', 'ldls', 'tyg', 'gi', 'homair', 'homab'];

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
