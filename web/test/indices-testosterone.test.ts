import { describe, it, expect } from 'vitest';
import { computeIndex, convertUnit, indexBands, indexZone, markersForIndex } from '../src/data/computedIndices';
import { INDEX_DEFS, TESTOSTERONE_MOLAR_MASS, testosteronePools } from '../src/data/indexDefs';
import type { Result } from '../src/types';
import { GOLD, RESULTS, r } from './fixtures/v2-golden-master';

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
});

// The exact anchor: the worked example on https://www.issam.ch/freetesuit.htm
// ("Explanation and examples", retrieved 2026-09-16), which uses the correct
// constants (Kt 1e9, Ka 3.6e4, albumin 69 kDa, T 288.4 g/mol). Two typos on the
// page are not copied: a 48.86e9 denominator (2 × 23.43 = 46.86) and FT
// multiplied by 288.5 rather than 288.4.
describe('cft and biot match ISSAM\'s published worked example (issam.ch/freetesuit.htm, retrieved 2026-09-16)', () => {
  const cft = INDEX_DEFS.find((d) => d.key === 'cft')!;
  const biot = INDEX_DEFS.find((d) => d.key === 'biot')!;
  const TOLERANCE = 0.0005; // [S] is printed to 5 significant figures
  const expectWithin = (actual: number, expected: number) => {
    expect(Math.abs(actual - expected) / expected).toBeLessThan(TOLERANCE);
  };

  const T_NMOL = 10; // the page's 288.4 ng/dL
  const SHBG = 40;
  const ALB = 4.3; // Ka·[Alb] = 22.43
  const FREE_T_MOLL = 1.7388e-10;

  const tNgdl = convertUnit(T_NMOL, 'T', 'nmol/L', 'ng/dL')!;
  const ftNgdl = cft.fn({ T: tNgdl, SHBG, ALB })! / 10;
  const ftNmol = convertUnit(ftNgdl, 'T', 'ng/dL', 'nmol/L')!;
  const bioNmol = biot.fn({ T: T_NMOL, SHBG, ALB })!;

  it('free T [S] = 1.7388e-10 mol/L', () => {
    expectWithin(ftNmol * 1e-9, FREE_T_MOLL);
  });

  it('free fraction 1.7388 %', () => {
    expectWithin((ftNmol / T_NMOL) * 100, 1.7388);
  });

  it('bioavailable T = [S] × 23.43', () => {
    expectWithin(bioNmol * 1e-9, FREE_T_MOLL * 23.43);
  });

  it('FT 5.02 ng/dL and bio-T 118 ng/dL at the page\'s 3 significant figures', () => {
    expect(Number(ftNgdl.toPrecision(3))).toBe(5.02);
    expect(Number(convertUnit(bioNmol, 'T', 'nmol/L', 'ng/dL')!.toPrecision(3))).toBe(118);
  });
});

// An independent check, not a gold standard: eight cases recorded by hand from
// the live calculator at https://www.issam.ch/freetesto.htm on 2026-09-16. Its
// script converts ng/dL to mol/L at ~280 g/mol (T / 2.8 × 1e-10) instead of
// 288.4 and displays 3 significant figures, hence the 1% tolerance. cftlh has
// no counterpart: issam.ch offers Vermeulen only.
describe('cft and biot cross-checked against the ISSAM calculator (issam.ch, retrieved 2026-09-16)', () => {
  const cft = INDEX_DEFS.find((d) => d.key === 'cft')!;
  const biot = INDEX_DEFS.find((d) => d.key === 'biot')!;
  const TOLERANCE = 0.01;
  const expectWithinPct = (actual: number, expected: number) => {
    expect(Math.abs(actual - expected) / expected).toBeLessThan(TOLERANCE);
  };

  // [T, T unit, SHBG nmol/L, ALB g/dL, free T, FT %, bioavailable T, bio %], free and bio-T in T's unit
  const ISSAM = [
    [888, 'ng/dL', 30, 4.3, 22.1, 2.49, 518, 58.3],
    [500, 'ng/dL', 40, 4.5, 9.15, 1.83, 224, 44.8],
    [300, 'ng/dL', 60, 4.3, 3.95, 1.32, 92.5, 30.8],
    [446, 'ng/dL', 24.9, 4.3, 10.8, 2.41, 252, 56.6],
    [150, 'ng/dL', 80, 3.5, 1.58, 1.05, 30.4, 20.3],
    [1200, 'ng/dL', 15, 5.0, 35.6, 2.97, 965, 80.4],
    [250, 'ng/dL', 100, 4.3, 2.15, 0.86, 50.4, 20.2],
    [15, 'nmol/L', 40, 4.3, 0.275, 1.83, 6.44, 42.9],
  ] as const;

  it.each(ISSAM)('T %s %s, SHBG %s, ALB %s', (t, unit, shbg, alb, ft, ftPct, bio, bioPct) => {
    const tNgdl = unit === 'ng/dL' ? t : convertUnit(t, 'T', unit, 'ng/dL')!;
    const tNmol = unit === 'nmol/L' ? t : convertUnit(t, 'T', unit, 'nmol/L')!;
    const ftNgdl = cft.fn({ T: tNgdl, SHBG: shbg, ALB: alb })! / 10;
    const bioNmol = biot.fn({ T: tNmol, SHBG: shbg, ALB: alb })!;
    const ftOut = unit === 'ng/dL' ? ftNgdl : convertUnit(ftNgdl, 'T', 'ng/dL', unit)!;
    const bioOut = unit === 'nmol/L' ? bioNmol : convertUnit(bioNmol, 'T', 'nmol/L', unit)!;

    expectWithinPct(ftOut, ft);
    expectWithinPct((ftNgdl / tNgdl) * 100, ftPct);
    expectWithinPct(bioOut, bio);
    expectWithinPct((bioNmol / tNmol) * 100, bioPct);
  });
});

describe('testosteronePools with issam.ch\'s 280 g/mol solve (issam.ch, retrieved 2026-09-16)', () => {
  const tNmol = convertUnit(888, 'T', 'ng/dL', 'nmol/L')!;
  const pools = testosteronePools(tNmol, 30, 4.3, 280);
  const ngdl = (nmol: number) => Number(convertUnit(nmol, 'T', 'nmol/L', 'ng/dL')!.toPrecision(3));

  it('reproduces the calculator\'s display: free 2.49 %, FT 22.1 ng/dL, bio-T 518 ng/dL', () => {
    expect(Number(((pools.free / tNmol) * 100).toFixed(2))).toBe(2.49);
    expect(ngdl(pools.free)).toBe(22.1);
    expect(ngdl(pools.free + pools.albuminBound)).toBe(518);
  });

  it('defaults to the molar-masses.json solve', () => {
    expect(testosteronePools(tNmol, 30, 4.3, TESTOSTERONE_MOLAR_MASS)).toEqual(testosteronePools(tNmol, 30, 4.3));
  });
});

describe('cftlh (calculated free testosterone, Ly & Handelsman 2005)', () => {
  const cftlh = INDEX_DEFS.find((d) => d.key === 'cftlh')!;

  it('T >= 5 nmol/L branch (T=20, SHBG=30 -> FT 343.95 pmol/L -> 99.205842 pg/mL)', () => {
    expect(cftlh.fn({ T: 20, SHBG: 30 })).toBeCloseTo(99.205842, 5);
  });

  it('T < 5 nmol/L branch (T=3, SHBG=30 -> FT 44.368 pmol/L -> 12.797107 pg/mL)', () => {
    expect(cftlh.fn({ T: 3, SHBG: 30 })).toBeCloseTo(12.797107, 5);
  });

  it('returns null (not a negative number) when the T>=5 regression goes negative (T=5, SHBG=800)', () => {
    expect(cftlh.fn({ T: 5, SHBG: 800 })).toBeNull();
  });

  it('returns null (not a negative number) when the T<5 regression goes negative (T=1, SHBG=400)', () => {
    expect(cftlh.fn({ T: 1, SHBG: 400 })).toBeNull();
  });

  it('has no albumin input, unlike cft', () => {
    expect(cftlh.inputKeys).toEqual(['T', 'SHBG']);
    expect(cftlh.optionalInputKeys ?? []).toEqual([]);
  });

  it('returns null when T or SHBG is missing', () => {
    expect(cftlh.fn({ T: 20 })).toBeNull();
    expect(cftlh.fn({ SHBG: 30 })).toBeNull();
  });
});

describe('biot (bioavailable testosterone, Vermeulen 1999)', () => {
  const biot = INDEX_DEFS.find((d) => d.key === 'biot')!;
  const cft = INDEX_DEFS.find((d) => d.key === 'cft')!;
  const KA = 3.6e4;
  const KS = 1e9;
  const albMolL = (gdl: number) => (gdl * 10) / 69000;

  // Solved by bisection on the mass balance T = FT + Ka·A·FT + S·Ks·FT/(1 + Ks·FT),
  // not by the quadratic the index uses, so the two are independent.
  const freeTByBisection = (tNmol: number, sNmol: number, albGdl: number): number => {
    const T = tNmol * 1e-9;
    const S = sNmol * 1e-9;
    const A = albMolL(albGdl);
    const excess = (ft: number) => ft + KA * A * ft + (S * KS * ft) / (1 + KS * ft) - T;
    let lo = 0;
    let hi = T;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (excess(mid) > 0) hi = mid;
      else lo = mid;
    }
    return ((lo + hi) / 2) * 1e9;
  };

  it('TT 15 nmol/L, SHBG 40 nmol/L, albumin 43 g/L -> bio-T 6.409456 nmol/L', () => {
    const ft = freeTByBisection(15, 40, 4.3);
    expect(ft).toBeCloseTo(0.273502, 5);
    expect((ft / 15) * 100).toBeGreaterThan(1);
    expect((ft / 15) * 100).toBeLessThan(3);
    expect(biot.fn({ T: 15, SHBG: 40, ALB: 4.3 })!).toBeCloseTo(6.409456, 5);
  });

  it('is free T × (1 + Ka·albumin)', () => {
    for (const [t, s, alb] of [[15, 40, 4.3], [15, 40, 4.5], [30, 20, 3.5], [8, 70, 3.9]] as const) {
      const expected = freeTByBisection(t, s, alb) * (1 + KA * albMolL(alb));
      expect(biot.fn({ T: t, SHBG: s, ALB: alb })!).toBeCloseTo(expected, 6);
    }
  });

  it('agrees with cft scaled by the albumin term', () => {
    const tNgdl = convertUnit(15, 'T', 'nmol/L', 'ng/dL')!;
    const ftNmol = convertUnit(cft.fn({ T: tNgdl, SHBG: 40, ALB: 4.3 })! / 10, 'T', 'ng/dL', 'nmol/L')!;
    expect(biot.fn({ T: 15, SHBG: 40, ALB: 4.3 })!).toBeCloseTo(ftNmol * (1 + KA * albMolL(4.3)), 6);
  });

  it('takes albumin as 4.3 g/dL when no reading exists', () => {
    expect(biot.fn({ T: 15, SHBG: 40 })).toBe(biot.fn({ T: 15, SHBG: 40, ALB: 4.3 }));
    const draw = Object.fromEntries([r('14913-8', 15, 'nmol/L'), r('13967-5', 40, 'nmol/L')]);
    expect(markersForIndex(biot, draw)['ALB']).toBeUndefined();
    expect(computeIndex(biot, draw)).toBeCloseTo(6.41, 10);
  });

  it('converts albumin printed in g/L and testosterone printed in ng/dL', () => {
    const draw = Object.fromEntries([
      r('2986-8', convertUnit(15, 'T', 'nmol/L', 'ng/dL')!, 'ng/dL'),
      r('13967-5', 40, 'nmol/L'),
      r('1751-7', 43, 'г/л'),
    ]);
    const m = markersForIndex(biot, draw);
    expect(m['ALB']).toBeCloseTo(4.3, 10);
    expect(m['T']).toBeCloseTo(15, 10);
    expect(biot.fn(m)!).toBeCloseTo(6.409456, 5);
  });

  it('declines an albumin it cannot place in g/dL and falls back to the default', () => {
    const draw = Object.fromEntries([r('14913-8', 15, 'nmol/L'), r('13967-5', 40, 'nmol/L'), r('1751-7', 620, 'umol/L')]);
    expect(markersForIndex(biot, draw)['ALB']).toBeUndefined();
    expect(computeIndex(biot, draw)).toBeCloseTo(6.41, 10);
  });

  it('bands are Mayo\'s reference limits converted from ng/dL, per sex', () => {
    const nmol = (ngdl: number) => convertUnit(ngdl, 'T', 'ng/dL', 'nmol/L')!;
    const male = indexBands(biot, { sex: 'male' })!;
    expect(male.hi).toBe(true);
    expect(male.cut[0]).toBeCloseTo(nmol(83), 10);
    expect(male.cut[1]).toBeCloseTo(nmol(40), 10);
    expect(male.cut[0]).toBeCloseTo(2.8776, 4);
    const female = indexBands(biot, { sex: 'female' })!;
    expect(female.hi).toBeFalsy();
    expect(female.cut[0]).toBeCloseTo(nmol(4), 10);
    expect(female.cut[1]).toBeCloseTo(nmol(10), 10);
  });

  it('zones by sex, and carries no zone while sex is unset', () => {
    expect(indexZone(biot, 3.0, { sex: 'male' })).toBe('ok');
    expect(indexZone(biot, 2.0, { sex: 'male' })).toBe('warn');
    expect(indexZone(biot, 1.0, { sex: 'male' })).toBe('bad');
    expect(indexZone(biot, 0.1, { sex: 'female' })).toBe('ok'); // low for a man, normal for a woman
    expect(indexZone(biot, 0.2, { sex: 'female' })).toBe('warn');
    expect(indexZone(biot, 0.5, { sex: 'female' })).toBe('bad');
    expect(indexBands(biot, {})).toBeNull();
    expect(indexZone(biot, 3.0)).toBeNull();
  });

  it('returns null when SHBG or total T is missing', () => {
    expect(biot.fn({ T: 15, ALB: 4.3 })).toBeNull();
    expect(biot.fn({ SHBG: 40, ALB: 4.3 })).toBeNull();
    expect(computeIndex(biot, Object.fromEntries([r('14913-8', 15, 'nmol/L'), r('1751-7', 4.3, 'g/dL')]))).toBeNull();
  });
});

describe('testosterone fractions, % of total', () => {
  const def = (key: string) => INDEX_DEFS.find((d) => d.key === key)!;
  const [cft, cftpct, ftpct, cftlh, cftlhpct, biot, biotpct] =
    ['cft', 'cftpct', 'ftpct', 'cftlh', 'cftlhpct', 'biot', 'biotpct'].map(def);
  const nmolFromPgml = (pgml: number) => convertUnit(pgml / 10, 'T', 'ng/dL', 'nmol/L')!;

  it('sit right after their parent index', () => {
    const keys = INDEX_DEFS.map((d) => d.key);
    expect(keys.slice(keys.indexOf('cft'), keys.indexOf('cft') + 3)).toEqual(['cft', 'cftpct', 'ftpct']);
    expect(keys[keys.indexOf('cftlh') + 1]).toBe('cftlhpct');
    expect(keys[keys.indexOf('biot') + 1]).toBe('biotpct');
  });

  it('carry no bands', () => {
    for (const d of [cftpct, ftpct, cftlhpct, biotpct]) {
      expect([d.key, indexBands(d, { sex: 'male' })]).toEqual([d.key, null]);
    }
  });

  it('cftpct reproduces ISSAM\'s worked example: 1.7388 % at T 10 nmol/L, SHBG 40, ALB 4.3', () => {
    expect(Math.abs(cftpct.fn({ T: 10, SHBG: 40, ALB: 4.3 })! - 1.7388) / 1.7388).toBeLessThan(0.0005);
  });

  it('cftpct is cft over total T in molar terms, albumin defaulting as for cft', () => {
    for (const [t, s, alb] of [[10, 40, 4.3], [25, 15, 3.6], [6, 90, undefined]] as const) {
      const tNgdl = convertUnit(t, 'T', 'nmol/L', 'ng/dL')!;
      const expected = (nmolFromPgml(cft.fn({ T: tNgdl, SHBG: s, ALB: alb })!) / t) * 100;
      expect(cftpct.fn({ T: t, SHBG: s, ALB: alb })!).toBeCloseTo(expected, 8);
    }
  });

  it('biotpct is biot over total T: ≈ 40.74 % at T 10 nmol/L, SHBG 40, ALB 4.3', () => {
    // ISSAM prints [S] = 1.7388e-10 and Ka·[Alb] = 22.43, so 1.7388 × 23.43 ≈ 40.74 at 5 significant figures.
    expect(Math.abs(biotpct.fn({ T: 10, SHBG: 40, ALB: 4.3 })! - 40.74) / 40.74).toBeLessThan(0.0005);
    for (const [t, s, alb] of [[15, 40, 4.5], [30, 20, 3.5], [8, 70, undefined]] as const) {
      expect(biotpct.fn({ T: t, SHBG: s, ALB: alb })!).toBeCloseTo((biot.fn({ T: t, SHBG: s, ALB: alb })! / t) * 100, 8);
    }
  });

  it('cftlhpct is cftlh over total T in molar terms, null exactly where cftlh is', () => {
    for (const [t, s] of [[20, 30], [3, 30], [12, 55]] as const) {
      expect(cftlhpct.fn({ T: t, SHBG: s })!).toBeCloseTo((nmolFromPgml(cftlh.fn({ T: t, SHBG: s })!) / t) * 100, 8);
    }
    for (const [t, s] of [[5, 800], [1, 400]] as const) {
      expect(cftlh.fn({ T: t, SHBG: s })).toBeNull();
      expect(cftlhpct.fn({ T: t, SHBG: s })).toBeNull();
    }
  });

  it('ftpct divides measured free T by total T in molar terms, whatever units they were printed in', () => {
    const tNmol = 15;
    const ftPgml = 90;
    const expected = (nmolFromPgml(ftPgml) / tNmol) * 100;
    const asPrinted = [
      Object.fromEntries([r('2991-8', ftPgml, 'pg/mL'), r('14913-8', tNmol, 'nmol/L')]),
      Object.fromEntries([r('2991-8', ftPgml / 10, 'ng/dL'), r('2986-8', convertUnit(tNmol, 'T', 'nmol/L', 'ng/mL')!, 'ng/mL')]),
      Object.fromEntries([r('2991-8', nmolFromPgml(ftPgml) * 1000, 'pmol/L'), r('14913-8', tNmol, 'nmol/L')]),
    ];
    for (const draw of asPrinted) {
      expect(ftpct.fn(markersForIndex(ftpct, draw))!).toBeCloseTo(expected, 8);
    }
  });

  it('ftpct declines a free T it cannot place in pmol/L', () => {
    const draw = Object.fromEntries([r('2991-8', 90, '%'), r('14913-8', 15, 'nmol/L')]);
    expect(markersForIndex(ftpct, draw)['FT']).toBeUndefined();
    expect(computeIndex(ftpct, draw)).toBeNull();
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
