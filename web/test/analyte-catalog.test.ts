import { describe, it, expect } from 'vitest';
import { ANALYSES } from './dataFiles';
import { specimenOf, trimmedLongName } from '../src/data/analyteCatalog';

// The specimen scanner replaced /\s(?:in|of)\s([^[\]]+?)(\s+by\s.*)?$/ and the
// bracket pattern lost its leading \s*. These pin the edges those expressions
// handled, so the rewrite is held to the regexes' exact output.
describe('specimen clause scanner — edges of the regex it replaced', () => {
  it.each([
    ['A in B [x] in Serum', 'Serum', 'A in B'],
    ['A in Blood by method [x]', 'Blood', 'A by method'],
    ['A in Blood by X by Y', 'Blood', 'A by X by Y'],
    ['A by X in Blood', 'Blood', 'A by X'],
    ['A in Blood  by X', 'Blood', 'A by X'],
    ['A in Blood bystander', 'Blood bystander', 'A'],
    ['A in by X', 'by X', 'A'],
    ['A\tin\tBlood', 'Blood', 'A'],
    ['A in Blood by X\nY', 'Blood by X\nY', 'A'],
    ['A in Blood by\tX', 'Blood', 'A by\tX'],
    ['X in of Blood', 'of Blood', 'X'],
    ['A in B in C', 'B in C', 'A'],
    ['A of Blood in Serum', 'Blood in Serum', 'A'],
  ])('%j → specimen %j, trimmed %j', (name, specimen, trimmed) => {
    expect(specimenOf(name)).toBe(specimen);
    expect(trimmedLongName(name)).toBe(trimmed);
  });

  it.each([
    ['A in ', 'A in'],
    ['in Blood', 'in Blood'],
    ['A inBlood', 'A inBlood'],
    ['A in [x]', 'A in'],
    ['A in B]', 'A in B]'],
    ['Glucose [Mass/volume]in Serum', 'Glucose in Serum'],
  ])('%j carries no specimen clause and trims to %j', (name, trimmed) => {
    expect(specimenOf(name)).toBeUndefined();
    expect(trimmedLongName(name)).toBe(trimmed);
  });

  it('returns no specimen for an empty name', () => {
    expect(specimenOf('')).toBeUndefined();
  });

  it.each([
    ['A\t[B]\tC', 'A C'],
    ['A [B][C] D', 'A D'],
    ['A[B]C', 'A C'],
    ['A \n[B]', 'A'],
    ['[B] A', 'A'],
    ['A [B [C]]', 'A [B ]'],
  ])('bracket removal of %j gives %j', (name, trimmed) => {
    expect(trimmedLongName(name)).toBe(trimmed);
  });

  it('reads every catalog name to a specimen that closes the name', () => {
    for (const a of ANALYSES) {
      const specimen = specimenOf(a.longCommonName);
      if (specimen === undefined) continue;
      expect(specimen).not.toMatch(/[[\]]/);
      expect(a.longCommonName).toContain(specimen);
    }
  });
});
