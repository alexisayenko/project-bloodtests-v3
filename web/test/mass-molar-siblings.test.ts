import { describe, it, expect } from 'vitest';
import { MASS_MOLAR_SIBLINGS } from '../src/data/massMolarSiblings';
import { ALIAS_TO_PRIMARY, ANALYTE_BY_LOINC, DEFAULT_UNITS } from '../src/data/analyteCatalog';
import { MOLAR_MASS_BY_ID } from '../src/data/molarMasses';
import { dimensionOf } from '../src/data/unitNormalization';

describe('MASS_MOLAR_SIBLINGS', () => {
  it('names each side with its LOINC scale, carries a factor, and lists every code once', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      expect(pair.mass.longCommonName).toContain('[Mass/volume]');
      expect(pair.molar.longCommonName).toContain('[Moles/volume]');
      expect(pair.massPerMolarUnit).toBeGreaterThan(0);
    }
    const codes = MASS_MOLAR_SIBLINGS.flatMap((pair) => [pair.mass.loinc, pair.molar.loinc]);
    expect(new Set(codes).size).toBe(codes.length);
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
});
