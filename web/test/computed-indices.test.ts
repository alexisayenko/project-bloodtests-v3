import { describe, it, expect } from 'vitest';
import { INDEX_DEFS, computeIndex, markersForIndex, zone } from '../src/data/computedIndices';
import type { Result } from '../src/types';

/**
 * Golden-master for all derived indices, ported from
 * project-bloodtests-v2 engine/test/indices.test.ts. Expected values are the
 * v2 GOLD constants (byte-identical); v3 drops the age/sex indices (eGFR ×3,
 * FIB-4), so those golds are omitted.
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
      analysis: '',
      symbol: '',
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
const GOLD: Record<string, number> = {
  ka: 3,
  tchdl: 4,
  ldlhdl: 2.4,
  aip: 0.117209,
  nonhdl: 150,
  remnant: 30,
  vldl: 30,
  apobapoa: 0.692308,
  tyg: 8.871365,
  gi: 11.875,
  homair: 1.874669,
  homab: 90.267715,
  cft: 93.163378,
  tlh: 100,
  te2: 16.666667,
  dhtt: 8,
  cortdhea: 0.060995,
  ft3ft4: 0.284597,
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
});

describe('calculatedFreeTestosterone via the cft index (Vermeulen golden master)', () => {
  const cft = INDEX_DEFS.find((d) => d.key === 'cft')!;
  const fixture = (t_ngdl: number, shbg: number, alb?: number) => {
    const m: Record<string, number | undefined> = { T: t_ngdl, SHBG: shbg };
    if (alb != null) m['ALB'] = alb;
    return m;
  };

  it('sanity example (total 888 ng/dL)', () => {
    expect(cft.fn(fixture(888, 30, 4.3))!).toBeCloseTo(219.40113, 5);
  });

  it('mid case', () => {
    expect(cft.fn(fixture(500, 40, 4.5))!).toBeCloseTo(91.114808, 5);
  });

  it('albumin defaults to 4.3 when omitted', () => {
    expect(cft.fn(fixture(300, 60))!).toBeCloseTo(39.353951, 5);
  });

  it('matches the ISSAM reference calculator (T 446, SHBG 24.9, ALB 4.3 → ~2.41%)', () => {
    const ft = cft.fn(fixture(446, 24.9, 4.3))!;
    const pct = (ft / 10 / 446) * 100;
    expect(pct).toBeCloseTo(2.41, 1);
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
