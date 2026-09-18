import { describe, it, expect } from 'vitest';
import { convertUnit, markersForIndex } from '../src/data/computedIndices';
import { INDEX_DEFS } from '../src/data/indexDefs';
import { r } from './fixtures/v2-golden-master';

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

describe('LDL-C estimate (Martin-Hopkins 2013)', () => {
  const ldlmh = INDEX_DEFS.find((d) => d.key === 'ldlmh')!;
  const m = (TC: number, hdl: number, TRIG: number) => ({ TC, 'HDL-C': hdl, TRIG });

  it('TC 200, HDL 50, TG 150 -> non-HDL 150 (130-159 col) x TG 150 (147-154 row) = factor 5.7 -> 123.684211', () => {
    // 150 - 150/5.7
    expect(ldlmh.fn(m(200, 50, 150))).toBeCloseTo(123.684211, 5);
  });

  it('TC 250, HDL 40, TG 300 -> non-HDL 210 (190-219 col) x TG 300 (293-399 row) = factor 6.5 -> 163.846154', () => {
    // 210 - 300/6.5
    expect(ldlmh.fn(m(250, 40, 300))).toBeCloseTo(163.846154, 5);
  });

  it('TC 320, HDL 100, TG 97 -> non-HDL 220 (>=220 col) x TG 97 (the table\'s one documented dip row) = factor 4.3 -> 197.441860', () => {
    // 220 - 97/4.3
    expect(ldlmh.fn(m(320, 100, 97))).toBeCloseTo(197.44186, 5);
  });

  it('is suppressed below the table\'s TG floor (7 mg/dL) and above its ceiling (13975 mg/dL)', () => {
    expect(ldlmh.fn(m(200, 50, 6))).toBeNull();
    expect(ldlmh.fn(m(200, 50, 7))).not.toBeNull();
    expect(ldlmh.fn(m(200, 50, 13975))).not.toBeNull();
    expect(ldlmh.fn(m(200, 50, 13976))).toBeNull();
  });

  it('returns null when an input is missing', () => {
    expect(ldlmh.fn({ TC: 200, 'HDL-C': 50 })).toBeNull();
  });

  it('mmol/L inputs go through the mg/dL conversion before the table lookup', () => {
    const si = Object.fromEntries([
      r('2093-3', convertUnit(200, 'TC', 'mg/dL', 'mmol/L')!, 'mmol/L'),
      r('2085-9', convertUnit(50, 'HDL-C', 'mg/dL', 'mmol/L')!, 'mmol/L'),
      r('2571-8', convertUnit(150, 'TRIG', 'mg/dL', 'mmol/L')!, 'mmol/L'),
    ]);
    expect(ldlmh.fn(markersForIndex(ldlmh, si))!).toBeCloseTo(123.684211, 5);
  });
});
