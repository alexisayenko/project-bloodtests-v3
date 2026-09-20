import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ANALYSES, MONITORING_PANELS, PANELS } from './dataFiles';
import { ALIAS_TO_PRIMARY, ALLOWED_UNITS, ANALYTE_BY_LOINC, DEFAULT_UNITS, PRINTED_UNIT_ALIASES, SHORT_NAMES, SPECIMENS } from '../src/data/analyteCatalog';
import { dimensionOf } from '../src/data/unitNormalization';
import { compileSchema, schemaErrors } from './helpers/schema';

const { validate, subschema } = compileSchema('analytes-1.schema.json');

describe('reference data conforms to analytes-1.schema.json', () => {
  it('analyses.json is a valid analyte catalog', () => {
    expect(schemaErrors(validate, ANALYSES)).toEqual([]);
  });

  it('panels.json entries are valid laboratory groups', () => {
    const validate = subschema('#/$defs/labPanel');
    expect(PANELS.flatMap((p) => schemaErrors(validate, p).map((e) => `${p.id}: ${e}`))).toEqual([]);
  });

  it('monitoring-panels.json entries are valid panel compositions', () => {
    const validate = subschema('#/$defs/monitoringPanel');
    expect(MONITORING_PANELS.flatMap((p) => schemaErrors(validate, p).map((e) => `${p.name}: ${e}`))).toEqual([]);
  });

  it('rejects an entry with an unknown key or a short name lacking a unit', () => {
    const validate = subschema('#/$defs/analyte');
    const base = { loinc: '1-8', longCommonName: 'x', friendlyName: 'x', lang: { 'ru-RU': 'x' } };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, shortt: 'T' })).toBe(false);
    expect(validate({ ...base, shortName: 'T' })).toBe(false);
    expect(validate({ ...base, loinc: '900101' })).toBe(false);
    expect(validate({ ...base, aliasOf: '2-6' })).toBe(false);
  });

  it('accepts printedUnitAliases only as a non-empty string map on an entry with a unit', () => {
    const validate = subschema('#/$defs/analyte');
    const base = { loinc: '1-8', longCommonName: 'x', friendlyName: 'x', lang: { 'ru-RU': 'x' }, unit: 'g/dL' };
    expect(validate({ ...base, printedUnitAliases: { '%': 'g/dL' } })).toBe(true);
    expect(validate({ ...base, printedUnitAliases: {} })).toBe(false);
    expect(validate({ ...base, printedUnitAliases: { '%': 1 } })).toBe(false);
    const noUnit = { loinc: '1-8', longCommonName: 'x', friendlyName: 'x', lang: { 'ru-RU': 'x' } };
    expect(validate({ ...noUnit, printedUnitAliases: { '%': 'g/dL' } })).toBe(false);
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

  it('every printed-unit alias names a unit its own code accepts', () => {
    for (const [loinc, aliases] of Object.entries(PRINTED_UNIT_ALIASES)) {
      const accepted = [DEFAULT_UNITS[loinc], ...(ALLOWED_UNITS[loinc] ?? [])];
      for (const [printed, target] of Object.entries(aliases)) {
        expect(accepted, `${loinc}: "${printed}" aliases ${target}`).toContain(target);
      }
    }
  });

  it('MCHC (786-4) carries the % alias for g/dL', () => {
    expect(PRINTED_UNIT_ALIASES['786-4']).toEqual({ '%': 'g/dL' });
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
