import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { ANALYSES, LABORATORY_FILE, MOLAR_MASS_FILE, MONITORING_PANELS, PANELS, PATHWAY_RANGE_FILE } from './dataFiles';
import {
  PATHWAY_RANGE_MARKERS,
  PATHWAY_RANGE_SOURCES,
  PATHWAY_RANGE_SOURCE_BY_ID,
  convertConcentration,
  rangeStatus,
  rangesInUnit,
} from '../src/data/pathwayReferenceRanges';
import { LABORATORIES, LABORATORY_BY_ID } from '../src/data/labPricing';
import { ALIAS_TO_PRIMARY, ANALYTE_BY_LOINC, DEFAULT_UNITS, SHORT_NAMES, SPECIMENS, specimenOf, trimmedLongName } from '../src/data/analyteCatalog';
import {
  MOLAR_MASSES,
  MOLAR_MASS_BY_ID,
  massPerMolarUnit,
  molarMassFromFormula,
  molarPerMassUnit,
} from '../src/data/molarMasses';
import { MASS_MOLAR_SIBLINGS } from '../src/data/massMolarSiblings';
import { dimensionOf } from '../src/data/unitNormalization';

const SCHEMA_ID = 'https://blood.isayenko.net/schema/analytes-1.schema.json';
const MOLAR_SCHEMA_ID = 'https://blood.isayenko.net/schema/molar-masses-1.schema.json';
const LAB_SCHEMA_ID = 'https://blood.isayenko.net/schema/laboratories-1.schema.json';
const PATHWAY_SCHEMA_ID = 'https://blood.isayenko.net/schema/pathway-reference-ranges-1.schema.json';

function loadSchema(name: string): object {
  return JSON.parse(readFileSync(new URL(`../public/schema/${name}`, import.meta.url), 'utf8')) as object;
}

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
ajv.addSchema(loadSchema('analytes-1.schema.json'));
ajv.addSchema(loadSchema('molar-masses-1.schema.json'));
ajv.addSchema(loadSchema('laboratories-1.schema.json'));
ajv.addSchema(loadSchema('pathway-reference-ranges-1.schema.json'));

function validator(pointer: string): ValidateFunction {
  const compiled = ajv.getSchema(`${SCHEMA_ID}${pointer}`);
  if (!compiled) throw new Error(`no subschema at ${pointer}`);
  return compiled;
}

function errorsIn(validate: ValidateFunction, value: unknown): string[] {
  validate(value);
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
}

describe('reference data conforms to analytes-1.schema.json', () => {
  it('analyses.json is a valid analyte catalog', () => {
    expect(errorsIn(validator(''), ANALYSES)).toEqual([]);
  });

  it('panels.json entries are valid laboratory groups', () => {
    const validate = validator('#/$defs/labPanel');
    expect(PANELS.flatMap((p) => errorsIn(validate, p).map((e) => `${p.id}: ${e}`))).toEqual([]);
  });

  it('monitoring-panels.json entries are valid panel compositions', () => {
    const validate = validator('#/$defs/monitoringPanel');
    expect(MONITORING_PANELS.flatMap((p) => errorsIn(validate, p).map((e) => `${p.name}: ${e}`))).toEqual([]);
  });

  it('rejects an entry with an unknown key or a short name lacking a unit', () => {
    const validate = validator('#/$defs/analyte');
    const base = { loinc: '1-8', longCommonName: 'x', friendlyName: 'x', lang: { 'ru-RU': 'x' } };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, shortt: 'T' })).toBe(false);
    expect(validate({ ...base, shortName: 'T' })).toBe(false);
    expect(validate({ ...base, loinc: '900101' })).toBe(false);
    expect(validate({ ...base, aliasOf: '2-6' })).toBe(false);
  });
});

describe('reference data is internally consistent', () => {
  it('no LOINC is listed twice in the catalog', () => {
    const codes = ANALYSES.map((a) => a.loinc);
    expect(codes).toHaveLength(new Set(codes).size);
  });

  it('every aliasOf names a catalog entry that is not itself an alias', () => {
    for (const [alias, primary] of Object.entries(ALIAS_TO_PRIMARY)) {
      expect(ANALYTE_BY_LOINC[primary], `${alias} points at unknown ${primary}`).toBeDefined();
      expect(ANALYTE_BY_LOINC[primary]!.aliasOf, `${primary} is itself an alias`).toBeUndefined();
    }
  });

  it('every short name comes with the unit its range checks use', () => {
    for (const loinc of Object.keys(SHORT_NAMES)) {
      expect(DEFAULT_UNITS[loinc], `${loinc} has a short name but no unit`).toBeTruthy();
    }
  });

  it('every entry carries a LOINC long common name', () => {
    for (const a of ANALYSES) {
      expect(a.longCommonName?.trim(), `${a.loinc} has no long common name`).toBeTruthy();
    }
  });

  // Six entries named one analyte while their code identified another —
  // 2862-1 was catalogued as IgA but is Albumin by electrophoresis, 1557-8 as
  // Fructosamine but is Fasting glucose. A name-only check cannot see that;
  // only the service's own name for the code can. Regenerate the fixture with
  // `node scripts/fetch-loinc-names.mjs` (it queries clinicaltables.nlm.nih.gov
  // once per catalog code and rewrites the file) — the test never calls out.
  describe('every catalog name is the one the LOINC service gives for that code', () => {
    const fixture = JSON.parse(
      readFileSync(new URL('./fixtures/loinc-long-common-names.json', import.meta.url), 'utf8'),
    ) as { names: Record<string, string>; unknownToService: string[] };

    it('matches the service name for every code the service knows', () => {
      const drifted = ANALYSES.filter(
        (a) => fixture.names[a.loinc] && fixture.names[a.loinc] !== a.longCommonName,
      ).map((a) => `${a.loinc} ${a.friendlyName}: "${a.longCommonName}" vs "${fixture.names[a.loinc]}"`);
      expect(drifted).toEqual([]);
    });

    it('covers every catalog code, bar the ones recorded as unknown to the service', () => {
      const unnamed = ANALYSES.map((a) => a.loinc).filter((l) => !fixture.names[l]);
      expect(unnamed.sort(), 'regenerate the fixture after changing a code').toEqual(
        [...fixture.unknownToService].sort(),
      );
    });
  });

  // 14913-8 was catalogued under 2986-8's "[Mass/volume]" name while carrying
  // nmol/L, and every derived map read the wrong scale off it.
  it("names a sibling code for the scale its own LOINC property declares", () => {
    const property = (loinc: string): string | undefined =>
      /\[(Mass|Moles)\/volume\]/.exec(ANALYTE_BY_LOINC[loinc]?.longCommonName ?? '')?.[1];
    for (const pair of MASS_MOLAR_SIBLINGS) {
      expect([pair.mass.loinc, property(pair.mass.loinc)]).toEqual([pair.mass.loinc, 'Mass']);
      expect([pair.molar.loinc, property(pair.molar.loinc)]).toEqual([pair.molar.loinc, 'Moles']);
    }
  });

  // "Glucose Serum" sat on 2339-0 and 15074-8, which LOINC names in *Blood*.
  // Whole-blood glucose runs 10-15% below plasma, so the label was not a
  // wording slip, it was the wrong quantity. A friendly name may abbreviate the
  // code's system but never contradict it.
  describe('a friendly name never claims a specimen the code contradicts', () => {
    // A word a friendly name may use, and the LOINC systems it is true of.
    const SPECIMEN_WORDS: [RegExp, RegExp][] = [
      [/\bserum\b/, /serum/],
      [/\bplasma\b/, /plasma/],
      [/\bwhole blood\b/, /^blood$/],
      [/\bblood\b/, /blood|red blood cells/],
      [/\burine\b/, /urine/],
      [/\bstool\b/, /stool|feces/],
      [/\bsaliva\b/, /saliva/],
      [/\bcsf\b|\bcerebrospinal\b/, /cerebrospinal/],
    ];

    it('names no specimen the code is not measured in', () => {
      const wrong: string[] = [];
      for (const a of ANALYSES) {
        const system = SPECIMENS[a.loinc]?.toLowerCase();
        if (!system) continue;
        const name = a.friendlyName.toLowerCase();
        for (const [word, allowed] of SPECIMEN_WORDS) {
          if (word.test(name) && !allowed.test(system)) {
            wrong.push(`${a.loinc} "${a.friendlyName}" is measured in ${SPECIMENS[a.loinc]}`);
          }
        }
      }
      expect(wrong).toEqual([]);
    });

    it('catches the fault it was written for', () => {
      const bad = { system: 'blood', name: 'glucose serum' };
      const [word, allowed] = SPECIMEN_WORDS[0]!;
      expect(word.test(bad.name) && !allowed.test(bad.system)).toBe(true);
    });
  });

  // 3091-6/22664-7 (Urea) were aliases of 3094-0 (Urea *nitrogen*) and shared
  // its label, folding two quantities 2.14x apart into one row. An alias is a
  // unit or method variant of its primary; a different measurand is not.
  it('no alias measures a different quantity from its primary', () => {
    // Words that turn a component into a different measurand of the same
    // substance rather than another way of reporting it.
    const MEASURAND_QUALIFIERS = new Set([
      'nitrogen', 'free', 'total', 'bound', 'equivalents', 'ionized', 'oxidized',
    ]);
    const words = (loinc: string): string[] =>
      (ANALYTE_BY_LOINC[loinc]?.longCommonName ?? '')
        .split(/\s*\[/)[0]!
        .toLowerCase()
        .split(/[\s.]+/)
        .filter(Boolean);

    const wrong: string[] = [];
    for (const [alias, primary] of Object.entries(ALIAS_TO_PRIMARY)) {
      const a = new Set(words(alias));
      const b = new Set(words(primary));
      const extra = [...a].filter((w) => !b.has(w)).concat([...b].filter((w) => !a.has(w)));
      const differing = extra.filter((w) => MEASURAND_QUALIFIERS.has(w));
      if (differing.length && (a.size !== b.size || differing.length === extra.length)) {
        wrong.push(`${alias} vs ${primary}: differ by ${differing.join(', ')}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  // 2998-3 and 30552-4 are [Mass/volume] codes the catalog recorded nmol/L
  // against, and 49246-0 was a [Mass/volume] name (for a code LOINC does not
  // have) carrying U/L. Per ADR-0003 that is a code error, so the catalog must
  // not state the pairing in the first place.
  it("every recorded unit matches the property its own LOINC name declares", () => {
    const EXPECTED: Record<string, string> = {
      Mass: 'mass/volume',
      Moles: 'substance/volume',
      Units: 'arbitrary/volume',
    };
    const wrong: string[] = [];
    for (const a of ANALYSES) {
      if (!a.unit) continue;
      const property = /\[(Mass|Moles|Units)\/volume\]/.exec(a.longCommonName)?.[1];
      const dimension = dimensionOf(a.unit);
      if (!property || !dimension) continue;
      if (dimension !== EXPECTED[property]) {
        wrong.push(`${a.loinc} ${a.friendlyName}: [${property}/volume] but unit ${a.unit} is ${dimension}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('every Monitoring Panel resolves against the laboratory groups', () => {
    const groupIds = new Set(PANELS.map((p) => p.id));
    for (const def of MONITORING_PANELS) {
      for (const id of [...(def.panelId ? [def.panelId] : []), ...(def.panelIds ?? [])]) {
        expect(groupIds.has(id), `${def.name} refers to unknown group ${id}`).toBe(true);
      }
    }
  });

  it('Monitoring Panel names are unique', () => {
    const names = MONITORING_PANELS.map((p) => p.name);
    expect(names).toHaveLength(new Set(names).size);
  });
});

describe('laboratories conform to laboratories-1.schema.json', () => {
  it('laboratories.json is a valid laboratory registry', () => {
    expect(errorsIn(ajv.getSchema(LAB_SCHEMA_ID)!, LABORATORY_FILE)).toEqual([]);
  });

  it('rejects a price line with an unknown key, a non-LOINC code, no codes or a non-positive price', () => {
    const validate = ajv.getSchema(`${LAB_SCHEMA_ID}#/$defs/priceLine`)!;
    const base = { label: 'TC', price: 167, covers: ['2093-3'] };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, prce: 167 })).toBe(false);
    expect(validate({ ...base, covers: ['900101'] })).toBe(false);
    expect(validate({ ...base, covers: [] })).toBe(false);
    expect(validate({ ...base, price: 0 })).toBe(false);
    expect(validate({ ...base, price: -1 })).toBe(false);
  });
});

describe('laboratories are internally consistent', () => {
  it('no laboratory id is listed twice', () => {
    const ids = LABORATORIES.map((lab) => lab.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('no label is listed twice within a laboratory', () => {
    for (const lab of LABORATORIES) {
      const labels = lab.prices.map((line) => line.label);
      expect(labels, lab.id).toHaveLength(new Set(labels).size);
    }
  });

  it('every price is positive', () => {
    const wrong = LABORATORIES.flatMap((lab) =>
      lab.prices.filter((line) => !(line.price > 0)).map((line) => `${lab.id} ${line.label}: ${line.price}`)
    );
    expect(wrong).toEqual([]);
  });

  it('every covered code is in the catalog', () => {
    const unknown = LABORATORIES.flatMap((lab) =>
      lab.prices.flatMap((line) =>
        line.covers.filter((code) => !ANALYTE_BY_LOINC[code]).map((code) => `${lab.id} ${line.label}: ${code}`)
      )
    );
    expect(unknown).toEqual([]);
  });

  it('a bundle naming a laboratory group covers exactly that group', () => {
    for (const lab of LABORATORIES) {
      for (const line of lab.prices.filter((l) => l.panelId)) {
        const group = PANELS.find((p) => p.id === line.panelId);
        expect(group, `${lab.id} ${line.label} names unknown group ${line.panelId}`).toBeDefined();
        const codes = group!.loincs ?? group!.sections!.flatMap((s) => s.loincs);
        expect([...line.covers].sort(), `${lab.id} ${line.label}`).toEqual([...codes].sort());
      }
    }
  });

  it("prices Esculab's full blood count as the fbc group", () => {
    expect(LABORATORY_BY_ID.esculab?.prices.find((line) => line.label === 'FBC')?.panelId).toBe('fbc');
  });
});

describe('molar masses conform to molar-masses-1.schema.json', () => {
  it('molar-masses.json is a valid molar-mass table', () => {
    const validate = ajv.getSchema(MOLAR_SCHEMA_ID)!;
    expect(errorsIn(validate, MOLAR_MASS_FILE)).toEqual([]);
  });

  it('rejects an entry with an unknown key, a bad formula, or a conventional basis with no note', () => {
    const validate = ajv.getSchema(`${MOLAR_SCHEMA_ID}#/$defs/molarMass`)!;
    const base = {
      id: 'glucose',
      name: 'Glucose',
      formula: 'C6H12O6',
      molarMassGPerMol: 180.156,
      basis: 'compound',
      sources: [
        {
          authority: 'PubChem',
          identifier: 'CID 5793',
          url: 'https://pubchem.ncbi.nlm.nih.gov/compound/5793',
          retrieved: '2026-09-08',
        },
      ],
    };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, formulaa: 'C6H12O6' })).toBe(false);
    expect(validate({ ...base, formula: '6C12H6O' })).toBe(false);
    expect(validate({ ...base, id: 'Glucose' })).toBe(false);
    expect(validate({ ...base, molarMassGPerMol: 0 })).toBe(false);
    expect(validate({ ...base, basis: 'conventional' })).toBe(false);
    expect(validate({ ...base, basis: 'conventional', note: 'why' })).toBe(true);
    expect(validate({ ...base, sources: [] })).toBe(false);
  });
});

describe('molar masses are internally consistent', () => {
  it('no id is listed twice', () => {
    const ids = MOLAR_MASSES.map((m) => m.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('every tabulated mass is reproducible from its formula and the atomic weights', () => {
    for (const entry of MOLAR_MASSES) {
      const recomputed = molarMassFromFormula(entry.formula);
      expect(recomputed, `${entry.id}: formula ${entry.formula} uses an untabulated element`).toBeDefined();
      expect(recomputed!, `${entry.id}: ${entry.formula}`).toBeCloseTo(entry.molarMassGPerMol, 5);
    }
  });

  it('every tabulated mass agrees with a cited source to within 0.05%', () => {
    for (const entry of MOLAR_MASSES) {
      const reported = entry.sources
        .map((s) => s.reportedMolarMassGPerMol)
        .filter((v): v is number => v !== undefined);
      if (entry.basis === 'conventional' && reported.length === 0) continue;
      expect(reported.length, `${entry.id} has no source reporting a mass to check against`).toBeGreaterThan(0);
      for (const value of reported) {
        const deviation = Math.abs(value - entry.molarMassGPerMol) / entry.molarMassGPerMol;
        expect(deviation, `${entry.id}: tabulated ${entry.molarMassGPerMol}, source ${value}`).toBeLessThan(5e-4);
      }
    }
  });

  it('a conventional mass says in its own note what the convention is', () => {
    for (const entry of MOLAR_MASSES.filter((m) => m.basis === 'conventional')) {
      expect(entry.note, `${entry.id} is conventional but unexplained`).toBeTruthy();
    }
  });

  it('every mass/molar sibling pair names a tabulated molar mass', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      expect(MOLAR_MASS_BY_ID[pair.molarMass], `${pair.analyte} → unknown ${pair.molarMass}`).toBeDefined();
      expect(pair.molarMassGPerMol).toBe(MOLAR_MASS_BY_ID[pair.molarMass]!.molarMassGPerMol);
    }
  });

  it('every sibling code is catalogued, and takes the unit the catalog gives it', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      for (const side of [pair.mass, pair.molar]) {
        expect(ANALYTE_BY_LOINC[side.loinc], `${pair.analyte}: ${side.loinc} is not in the catalog`).toBeDefined();
        expect([side.loinc, side.unit]).toEqual([side.loinc, DEFAULT_UNITS[side.loinc]]);
      }
    }
  });

  it('gives each sibling code a unit on the scale its LOINC name declares', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      expect([pair.analyte, dimensionOf(pair.mass.unit)]).toEqual([pair.analyte, 'mass/volume']);
      expect([pair.analyte, dimensionOf(pair.molar.unit)]).toEqual([pair.analyte, 'substance/volume']);
    }
  });

  it('folds a molar sibling into its mass code rather than beside it', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      const primary = ALIAS_TO_PRIMARY[pair.molar.loinc] ?? pair.molar.loinc;
      const massPrimary = ALIAS_TO_PRIMARY[pair.mass.loinc] ?? pair.mass.loinc;
      expect([pair.analyte, primary]).toEqual([pair.analyte, massPrimary]);
    }
  });

  it('derives the conversion factors the app actually uses', () => {
    // Spot-checks in both directions, on the four decimal prefixes in play.
    expect(massPerMolarUnit('cholesterol', 'mg/dL', 'mmol/L')).toBeCloseTo(38.6664, 4);
    expect(massPerMolarUnit('glucose', 'mg/dL', 'mmol/L')).toBeCloseTo(18.0156, 4);
    expect(massPerMolarUnit('creatinine', 'mg/dL', 'umol/L')).toBeCloseTo(0.011312, 6);
    expect(massPerMolarUnit('iron', 'ug/dL', 'umol/L')).toBeCloseTo(5.5845, 4);
    expect(molarPerMassUnit('testosterone', 'ng/dL', 'nmol/L')).toBeCloseTo(0.0346703, 7);
    expect(molarPerMassUnit('thyroxine', 'ng/dL', 'pmol/L')).toBeCloseTo(12.8721, 4);
    expect(molarPerMassUnit('triiodothyronine', 'pg/mL', 'pmol/L')).toBeCloseTo(1.5361516, 6);
  });

  it('refuses a unit it does not fully understand rather than guessing', () => {
    expect(() => massPerMolarUnit('glucose', 'mg/dL', 'mg/dL')).toThrow();
    expect(() => massPerMolarUnit('glucose', 'U/L', 'mmol/L')).toThrow();
    expect(() => massPerMolarUnit('glucose', 'mg', 'mmol/L')).toThrow();
    expect(() => massPerMolarUnit('glucose', 'mg/dL', 'mmol/kg')).toThrow();
    expect(() => massPerMolarUnit('unobtainium', 'mg/dL', 'mmol/L')).toThrow();
    expect(molarMassFromFormula('Xx2')).toBeUndefined();
    expect(molarMassFromFormula('h2o')).toBeUndefined();
  });
});

describe('pathway reference ranges conform to pathway-reference-ranges-1.schema.json', () => {
  it('pathway-reference-ranges.json is a valid range table', () => {
    expect(errorsIn(ajv.getSchema(PATHWAY_SCHEMA_ID)!, PATHWAY_RANGE_FILE)).toEqual([]);
  });

  it('rejects a range with an unknown key, no bound, or no source', () => {
    const validate = ajv.getSchema(`${PATHWAY_SCHEMA_ID}#/$defs/range`)!;
    const base = { population: 'Adult men', low: 1, high: 2, unit: 'IU/L', sources: ['a'] };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, hgih: 2 })).toBe(false);
    expect(validate({ population: 'Adult men', unit: 'IU/L', sources: ['a'] })).toBe(false);
    expect(validate({ ...base, sources: [] })).toBe(false);
  });
});

describe('pathway reference ranges are internally consistent', () => {
  it('no marker or source id is listed twice', () => {
    const markers = PATHWAY_RANGE_MARKERS.map((m) => m.id);
    const sources = PATHWAY_RANGE_SOURCES.map((s) => s.id);
    expect(markers).toHaveLength(new Set(markers).size);
    expect(sources).toHaveLength(new Set(sources).size);
  });

  it('every cited source exists and every source is cited', () => {
    const cited = new Set(PATHWAY_RANGE_MARKERS.flatMap((m) => m.ranges.flatMap((r) => r.sources)));
    for (const id of cited) expect(PATHWAY_RANGE_SOURCE_BY_ID[id], `unknown source ${id}`).toBeDefined();
    for (const s of PATHWAY_RANGE_SOURCES) expect(cited.has(s.id), `${s.id} is never cited`).toBe(true);
  });

  it('every code is catalogued and every molar mass is tabulated', () => {
    for (const m of PATHWAY_RANGE_MARKERS) {
      for (const loinc of m.loincs) expect(ANALYTE_BY_LOINC[loinc], `${m.id}: ${loinc}`).toBeDefined();
      if (m.molarMass) expect(MOLAR_MASS_BY_ID[m.molarMass], `${m.id}: ${m.molarMass}`).toBeDefined();
    }
  });

  it('every range is ordered and places on the catalog unit of one of its codes', () => {
    for (const m of PATHWAY_RANGE_MARKERS) {
      for (const r of m.ranges) {
        if (r.low != null && r.high != null) expect(r.low, `${m.id}: ${r.population}`).toBeLessThan(r.high);
      }
      const populations = [...new Set(m.ranges.map((r) => r.population))];
      for (const population of populations) {
        const placesSomewhere = m.loincs.some((loinc) =>
          rangesInUnit(m, DEFAULT_UNITS[loinc]).some((r) => r.population === population && r.placed)
        );
        expect([m.id, population, placesSomewhere]).toEqual([m.id, population, true]);
      }
    }
  });

  it('converts only through derived factors and refuses what it cannot place', () => {
    expect(convertConcentration(1.7, 'IU/L', 'mIU/mL')).toBe(1.7);
    expect(convertConcentration(35, 'g/L', 'g/dL')).toBeCloseTo(3.5, 10);
    expect(convertConcentration(159, 'pmol/L', 'pg/mL', 'estradiol')).toBeCloseTo(159 * 0.272388, 6);
    expect(convertConcentration(264, 'ng/dL', 'nmol/L', 'testosterone')).toBeCloseTo(264 * molarPerMassUnit('testosterone', 'ng/dL', 'nmol/L'), 10);
    expect(convertConcentration(159, 'pmol/L', 'pg/mL')).toBeUndefined();
    expect(convertConcentration(1, 'IU/L', 'g/L')).toBeUndefined();
  });

  it('keeps a population on the source’s own figures when its unit cannot be reached, and rates a value against every age row', () => {
    const dht = PATHWAY_RANGE_MARKERS.find((m) => m.id === 'dht')!;
    expect(rangesInUnit(dht, 'nmol/L').map((r) => [r.low, r.high, r.unit, r.placed])).toEqual([[0.47, 2.65, 'nmol/L', true]]);
    expect(rangesInUnit(dht, 'U/L').every((r) => !r.placed && r.unit === 'ng/dL')).toBe(true);
    const shbg = rangesInUnit(PATHWAY_RANGE_MARKERS.find((m) => m.id === 'shbg')!, 'nmol/L');
    expect(rangeStatus(30, shbg)).toBe('ok');
    expect(rangeStatus(60, shbg)).toBe('warn');
    expect(rangeStatus(100, shbg)).toBe('bad');
    expect(rangeStatus(30, rangesInUnit(dht, 'U/L'))).toBeUndefined();
  });
});

describe('specimen derived from the long common name', () => {
  it('reads the system out of an "in …" clause, dropping any method', () => {
    expect(specimenOf('Glucose [Mass/volume] in Serum or Plasma')).toBe('Serum or Plasma');
    expect(specimenOf('Hemoglobin [Mass/volume] in Blood by Automated count')).toBe('Blood');
    expect(specimenOf('Reticulocytes/Erythrocytes [Pure number fraction] in Red Blood Cells')).toBe('Red Blood Cells');
  });

  it('reads an "of …" clause the same way', () => {
    expect(specimenOf('Hematocrit [Volume Fraction] of Blood by Automated count')).toBe('Blood');
  });

  it('never runs a match through the property bracket', () => {
    expect(specimenOf('MCH [Entitic mass] by Automated count')).toBeUndefined();
  });

  it('returns nothing rather than guessing when the name states no specimen', () => {
    expect(specimenOf('Prothrombin time (PT)')).toBeUndefined();
    expect(specimenOf(undefined)).toBeUndefined();
  });

  it('derives a specimen for all but the handful of names that omit one', () => {
    const without = ANALYSES.filter((a) => !SPECIMENS[a.loinc]);
    expect(without.length).toBeLessThanOrEqual(8);
    for (const a of without) expect(a.longCommonName).not.toMatch(/\s(?:in|of)\s/);
  });
});

describe('long common name trimmed for display', () => {
  it('drops both the property bracket and the specimen clause', () => {
    expect(trimmedLongName('25-hydroxyvitamin D3 [Mass/volume] in Serum or Plasma')).toBe('25-hydroxyvitamin D3');
  });

  it('keeps the method whether or not a specimen clause preceded it', () => {
    // The method is what tells two codes for one analyte apart, so it always stays.
    expect(trimmedLongName('MCH [Entitic mass] by Automated count')).toBe('MCH by Automated count');
    expect(trimmedLongName('Erythrocytes [#/volume] in Blood by Automated count')).toBe(
      'Erythrocytes by Automated count'
    );
    expect(trimmedLongName('Hematocrit [Volume Fraction] of Blood by Automated count')).toBe(
      'Hematocrit by Automated count'
    );
    expect(
      trimmedLongName('C reactive protein [Mass/volume] in Serum or Plasma by High sensitivity method')
    ).toBe('C reactive protein by High sensitivity method');
  });

  it('drops a specimen clause from a name that carries no property', () => {
    expect(trimmedLongName('Hemoglobin A1c/Hemoglobin.total in Blood by calculation')).toBe(
      'Hemoglobin A1c/Hemoglobin.total by calculation'
    );
  });

  it('drops only the trailing clause, not an "in" that is part of the analyte name', () => {
    expect(trimmedLongName('Cholesterol in HDL [Mass/volume] in Serum or Plasma')).toBe('Cholesterol in HDL');
  });

  it('leaves a name carrying neither part alone, parentheses included', () => {
    expect(trimmedLongName('Prothrombin time (PT)')).toBe('Prothrombin time (PT)');
    expect(trimmedLongName('Thrombin time')).toBe('Thrombin time');
  });

  it('never returns an empty name', () => {
    expect(trimmedLongName('[Mass/volume] in Serum')).toBe('[Mass/volume] in Serum');
    expect(trimmedLongName('')).toBe('');
  });

  it('leaves every catalog name non-empty and no longer than the stored one', () => {
    for (const a of ANALYSES) {
      const trimmed = trimmedLongName(a.longCommonName);
      expect(trimmed).not.toBe('');
      expect(trimmed.length).toBeLessThanOrEqual(a.longCommonName.length);
      expect(trimmed).not.toMatch(/[[\]]/);
    }
  });

  it('leaves no two catalog entries looking identical in the LOINC database table', () => {
    // Name, specimen and unit are the three columns a reader tells rows apart by.
    // Two codes agreeing on all three are indistinguishable on screen — which is
    // what dropping the method used to do to CRP, ESR and HbA1c.
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const a of ANALYSES) {
      const key = [trimmedLongName(a.longCommonName), SPECIMENS[a.loinc] ?? '', a.unit ?? ''].join(' | ');
      const first = seen.get(key);
      if (first) collisions.push(`${first} vs ${a.loinc}: ${key}`);
      else seen.set(key, a.loinc);
    }
    expect(collisions).toEqual([]);
  });
});
