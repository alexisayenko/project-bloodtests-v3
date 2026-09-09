import { describe, it, expect } from 'vitest';
import {
  applyFieldEdit,
  applyFixes,
  buildExpandedCatalog,
  buildNlmSuggestionsByRow,
  computeConfidentFixes,
  getChipSuggestions,
  getDotColor,
  getDotTitle,
  getMismatchMessage,
  getUnitLabel,
  isRowUnresolved,
  pluralize,
  referenceRangeOf,
  resolvedNameOf,
  saveButtonLabel,
  saveButtonStyle,
  unitRepairFor,
  type SuggestionChip,
} from '../src/components/conditions/reportDetailHelpers';
import { COLOR } from '../src/styles/tokens';
import { ALIAS_TO_PRIMARY, ALSO_REFS } from '../src/data/analyteCatalog';
import type { CrossCheckResult } from '../src/data/loincCheck';
import type { NlmEntry } from '../src/data/loincNlm';
import type { Analysis, Result } from '../src/types';
import type { ValidationIssue } from '../src/data/validateDiagnosticReports';

const createResult = (overrides?: Partial<Result>): Result => ({
  loinc: '2345-7',
  analysis: 'Glucose',
  symbol: 'GLU',
  section: '',
  value: 90,
  rawValue: '90',
  valueQualifier: '',
  unit: 'mg/dL',
  refText: '',
  refMin: 70,
  refMax: 100,
  method: '',
  ...overrides,
});

const issue = (overrides?: Partial<ValidationIssue>): ValidationIssue => ({
  groupFile: 'r1',
  resultIndex: 0,
  level: 'warning',
  message: 'Missing unit',
  ...overrides,
});

describe('referenceRangeOf', () => {
  it('prefers the printed text, falls back to both bounds, and is empty without either', () => {
    expect(referenceRangeOf(createResult({ refText: '< 200 Desirable' }))).toBe('< 200 Desirable');
    expect(referenceRangeOf(createResult())).toBe('70 - 100');
    expect(referenceRangeOf(createResult({ refMin: null, refMax: null }))).toBe('');
    expect(referenceRangeOf(createResult({ refMax: null }))).toBe(''); // one bound is not a range
  });
});

describe('pluralize', () => {
  it('is empty for exactly one and "s" for none or many', () => {
    expect(pluralize(1)).toBe('');
    expect(pluralize(0)).toBe('s');
    expect(pluralize(2)).toBe('s');
  });
});

describe('applyFieldEdit', () => {
  it('sets the loinc or the unit without touching the value', () => {
    const edited = applyFieldEdit(createResult(), 'loinc', '2339-0');
    expect(edited.loinc).toBe('2339-0');
    expect(edited.value).toBe(90);
    expect(applyFieldEdit(createResult(), 'unit', 'mmol/L').unit).toBe('mmol/L');
  });

  it('parses a numeric value, keeps the raw text, and nulls a non-numeric one', () => {
    const edited = applyFieldEdit(createResult(), 'value', '5.4');
    expect(edited.value).toBe(5.4);
    expect(edited.rawValue).toBe('5.4');

    const text = applyFieldEdit(createResult(), 'value', 'Negative');
    expect(text.value).toBeNull();
    expect(text.rawValue).toBe('Negative');
  });

  it('does not mutate the original', () => {
    const item = createResult();
    applyFieldEdit(item, 'loinc', '2339-0');
    expect(item.loinc).toBe('2345-7');
  });
});

describe('computeConfidentFixes', () => {
  const items = [createResult({ loinc: ' 2345-7 ' }), createResult({ loinc: '' })];

  it('collects a confident derivation that differs from the printed code', () => {
    const results: CrossCheckResult[] = [
      { status: 'match', confident: true, suggestions: [{ loinc: '2345-7', name: 'Glucose', score: 1 }] },
      { status: 'no-code', confident: true, suggestions: [{ loinc: '2093-3', name: 'Cholesterol', score: 1 }] },
    ];
    expect([...computeConfidentFixes(items, results)]).toEqual([[1, '2093-3']]);
  });

  it('ignores a derivation the resolver is not confident about', () => {
    const results: CrossCheckResult[] = [
      { status: 'match', confident: true, suggestions: [{ loinc: '2345-7', name: 'Glucose', score: 1 }] },
      { status: 'no-code', confident: false, suggestions: [{ loinc: '2093-3', name: 'Cholesterol', score: 1 }] },
    ];
    expect(computeConfidentFixes(items, results).size).toBe(0);
  });

  it('ignores rows with no suggestion at all', () => {
    const results: CrossCheckResult[] = [
      { status: 'unknown-code', confident: true },
      { status: 'no-code', confident: true },
    ];
    expect(computeConfidentFixes(items, results).size).toBe(0);
  });
});

describe('applyFixes', () => {
  it('rewrites only the fixed rows', () => {
    const items = [createResult({ loinc: 'a' }), createResult({ loinc: 'b' })];
    const out = applyFixes(items, new Map([[1, '2093-3']]));
    expect(out.map((i) => i.loinc)).toEqual(['a', '2093-3']);
    expect(out[0]).toBe(items[0]);
  });
});

describe('isRowUnresolved', () => {
  const items = [createResult({ loinc: '99999-9' })];

  it('keeps an unknown code unresolved until NLM names it', () => {
    const r: CrossCheckResult = { status: 'unknown-code' };
    expect(isRowUnresolved(r, 0, items, {}, {})).toBe(true);
    expect(isRowUnresolved(r, 0, items, { '99999-9': 'Some test' }, {})).toBe(false);
  });

  it('resolves a codeless row once it has any suggestion', () => {
    const bare: CrossCheckResult = { status: 'no-code' };
    expect(isRowUnresolved(bare, 0, items, {}, {})).toBe(true);
    expect(
      isRowUnresolved({ ...bare, suggestions: [{ loinc: '2345-7', name: 'Glucose', score: 1 }] }, 0, items, {}, {})
    ).toBe(false);
    expect(isRowUnresolved(bare, 0, items, {}, { 0: [{ loinc: '2345-7', name: 'Glucose' }] })).toBe(false);
  });

  it('treats matches and mismatches as resolved', () => {
    expect(isRowUnresolved({ status: 'match' }, 0, items, {}, {})).toBe(false);
    expect(isRowUnresolved({ status: 'mismatch' }, 0, items, {}, {})).toBe(false);
    expect(isRowUnresolved({ status: 'malformed' }, 0, items, {}, {})).toBe(false);
  });
});

describe('buildNlmSuggestionsByRow', () => {
  const items = [
    createResult({ loinc: '', analysis: 'Προλακτίνη Prolactin', unit: 'ng/mL' }),
    createResult({ loinc: '99999-9', analysis: 'Prolactin' }),
  ];
  const byName: Record<string, NlmEntry[]> = {
    Prolactin: [
      { loinc: '15081-3', name: 'Prolactin [Units/vol]', unit: 'mIU/L' },
      { loinc: '2842-3', name: 'Prolactin [Mass/vol]', unit: 'ng/mL' },
      { loinc: '20568-2', name: 'Prolactin panel' },
      { loinc: '11111-1', name: 'Prolactin extra' },
    ],
  };

  it('keys by the Latin part of the printed name and applies the unit selection', () => {
    const out = buildNlmSuggestionsByRow(
      [
        { r: { status: 'no-code' }, i: 0 },
        { r: { status: 'unknown-code' }, i: 1 },
      ],
      items,
      byName
    );
    expect(Object.keys(out)).toEqual(['0']);
    expect(out[0]!.map((e) => e.loinc)).toEqual(['2842-3', '20568-2', '11111-1']);
  });

  it('skips a row NLM returned nothing for', () => {
    expect(buildNlmSuggestionsByRow([{ r: { status: 'no-code' }, i: 0 }], items, {})).toEqual({});
  });
});

describe('resolvedNameOf', () => {
  const item = createResult({ loinc: '99999-9' });

  it('prefers the catalog name, falling back to the NLM one for an unknown code', () => {
    expect(resolvedNameOf(item, { status: 'match', loincName: 'Glucose' }, {})).toBe('Glucose');
    expect(resolvedNameOf(item, { status: 'unknown-code' }, { '99999-9': 'Odd test' })).toBe('Odd test');
  });

  it('is undefined without a check or a name', () => {
    expect(resolvedNameOf(item, undefined, {})).toBeUndefined();
    expect(resolvedNameOf(item, { status: 'no-code' }, {})).toBeUndefined();
    expect(resolvedNameOf(item, { status: 'unknown-code' }, { '99999-9': null })).toBeUndefined();
  });
});

describe('buildExpandedCatalog', () => {
  const [primary, refs] = Object.entries(ALSO_REFS)[0]!;
  const canonical: Analysis = {
    loinc: primary,
    displayName: 'Primary',
    longCommonName: 'Primary long name',
    lang: {},
  };

  it('adds an entry per alias, carrying the alias long name', () => {
    const out = buildExpandedCatalog({ [primary]: canonical });
    expect(out).toHaveLength(1 + refs.length);
    const added = out.find((a) => a.loinc === refs[0]!.loinc)!;
    expect(added.displayName).toBe('Primary');
    expect(added.longCommonName).toBe(refs[0]!.longCommonName);
  });

  it('does not duplicate an alias already in the catalog', () => {
    const alias: Analysis = { ...canonical, loinc: refs[0]!.loinc };
    const out = buildExpandedCatalog({ [primary]: canonical, [refs[0]!.loinc]: alias });
    expect(out.filter((a) => a.loinc === refs[0]!.loinc)).toHaveLength(1);
  });

  it('skips aliases whose primary is absent', () => {
    expect(buildExpandedCatalog({})).toEqual([]);
  });
});

describe('getMismatchMessage', () => {
  const item = createResult({ loinc: ' 2345-7 ' });

  it('is null when there is no mismatch', () => {
    expect(getMismatchMessage(item, { status: 'match' }, false)).toBeNull();
    expect(getMismatchMessage(item, undefined, true)).toBeNull();
  });

  it('names both codes when a derivation contradicts the printed one', () => {
    const msg = getMismatchMessage(
      item,
      { status: 'mismatch', loincName: 'Glucose', derived: { loinc: '2093-3', name: 'Cholesterol' } },
      true
    );
    expect(msg).toBe('printed code 2345-7 is Glucose — name+unit resolve to 2093-3 Cholesterol');
  });

  it('falls back to the plain name-differs wording', () => {
    expect(getMismatchMessage(item, { status: 'mismatch' }, true)).toBe(
      'Printed name differs from the LOINC name'
    );
  });
});

describe('getDotColor', () => {
  it('ranks error over warning over ok', () => {
    expect(getDotColor(true, true, true)).toBe(COLOR.statusBad);
    expect(getDotColor(false, true, false)).toBe(COLOR.statusWarn);
    expect(getDotColor(false, false, true)).toBe(COLOR.statusWarn);
    expect(getDotColor(false, false, false)).toBe(COLOR.statusOk);
  });
});

describe('getDotTitle', () => {
  it('joins the issue messages and the mismatch note, and says "OK" when there is nothing to say', () => {
    expect(getDotTitle([issue(), issue({ message: 'No range' })], 'codes disagree')).toBe(
      'Missing unit; No range; codes disagree'
    );
    expect(getDotTitle([], null)).toBe('OK');
  });
});

describe('unitRepairFor', () => {
  const cholesterolMolar = {
    loinc: '14647-2',
    name: 'Cholesterol [Moles/volume] in Serum or Plasma',
    unit: 'mmol/L',
  };
  const molarUnderMass = createResult({ loinc: '2093-3', analysis: 'Cholesterol', unit: 'mmol/L', value: 5.2 });

  it('names the molar sibling of a mass code printed in molar units', () => {
    expect(unitRepairFor(molarUnderMass)).toEqual(cholesterolMolar);
  });

  it('reads a Cyrillic spelling of the same unit', () => {
    expect(unitRepairFor(createResult({ loinc: '2093-3', unit: 'ммоль/л' }))).toEqual(cholesterolMolar);
  });

  it('names the mass sibling of a molar code printed in mass units', () => {
    expect(unitRepairFor(createResult({ loinc: '14647-2', unit: 'mg/dL' }))).toEqual({
      loinc: '2093-3',
      name: 'Cholesterol [Mass/volume] in Serum or Plasma',
      unit: 'mg/dL',
    });
  });

  it('offers nothing unless a sibling pair actually settles the clash', () => {
    // Unit fits the code; unit the tables cannot place; dimensions clash but no
    // sibling pair is known; no code at all; no unit at all.
    expect(unitRepairFor(createResult({ loinc: '2093-3', unit: 'mg/dL' }))).toBeUndefined();
    expect(unitRepairFor(createResult({ loinc: '2093-3', unit: 'сомнительно' }))).toBeUndefined();
    expect(unitRepairFor(createResult({ loinc: '3016-3', analysis: 'TSH', unit: 'mmol/L' }))).toBeUndefined();
    expect(unitRepairFor(createResult({ loinc: '', unit: 'mmol/L' }))).toBeUndefined();
    expect(unitRepairFor(createResult({ loinc: '2093-3', unit: '' }))).toBeUndefined();
  });

  it('repairs the code and leaves the printed value and unit alone', () => {
    const repaired = applyFieldEdit(molarUnderMass, 'loinc', unitRepairFor(molarUnderMass)!.loinc);
    expect(repaired).toMatchObject({ loinc: '14647-2', value: 5.2, rawValue: '90', unit: 'mmol/L' });
  });
});

describe('getChipSuggestions', () => {
  const local = [{ loinc: '2345-7', name: 'Glucose', score: 1 }];
  const nlm: NlmEntry[] = [{ loinc: '2339-0', name: 'Glucose [Mass/vol]' }];
  const repair = { loinc: '14647-2', name: 'Cholesterol [Moles/volume] in Serum or Plasma', unit: 'mmol/L' };

  it('offers the unit repair without a cross-check having run', () => {
    expect(getChipSuggestions(undefined, undefined, repair)).toEqual([repair]);
  });

  it('puts the unit repair ahead of the cross-check suggestions', () => {
    expect(getChipSuggestions({ status: 'no-code', suggestions: local }, undefined, repair)).toEqual([
      repair,
      ...local,
    ]);
  });

  it('does not offer the same code twice', () => {
    const same = [{ loinc: repair.loinc, name: 'Cholesterol', score: 1 }];
    expect(getChipSuggestions({ status: 'no-code', suggestions: same }, undefined, repair)).toEqual([repair]);
  });

  it('offers chips only on a resolvable status', () => {
    expect(getChipSuggestions({ status: 'no-code', suggestions: local }, undefined)).toEqual(local);
    expect(getChipSuggestions({ status: 'malformed', suggestions: local }, undefined)).toEqual(local);
    expect(getChipSuggestions({ status: 'mismatch', suggestions: local }, undefined)).toEqual(local);
    expect(getChipSuggestions({ status: 'match', suggestions: local }, undefined)).toEqual([]);
    expect(getChipSuggestions({ status: 'unknown-code' }, nlm)).toEqual([]);
  });

  it('prefers local suggestions over the NLM ones, and offers nothing without a check', () => {
    expect(getChipSuggestions({ status: 'no-code', suggestions: local }, nlm)).toEqual(local);
    expect(getChipSuggestions({ status: 'no-code' }, nlm)).toEqual(nlm);
    expect(getChipSuggestions({ status: 'no-code' }, undefined)).toEqual([]);
    expect(getChipSuggestions(undefined, nlm)).toEqual([]);
  });
});

describe('getUnitLabel', () => {
  const aliasCode = Object.keys(ALIAS_TO_PRIMARY)[0]!;

  it('labels a known unit-variant code', () => {
    const chip: SuggestionChip = { loinc: aliasCode, name: 'Variant', unit: 'mmol/L' };
    expect(getUnitLabel(chip, [chip])).toBe(' · mmol/L');
  });

  it('labels two chips that share a name', () => {
    const a: SuggestionChip = { loinc: '11111-1', name: 'Prolactin', unit: 'ng/mL' };
    const b: SuggestionChip = { loinc: '22222-2', name: 'Prolactin', unit: 'mIU/L' };
    expect(getUnitLabel(a, [a, b])).toBe(' · ng/mL');
  });

  it('stays silent when the unit adds nothing, and when there is no unit', () => {
    const plain: SuggestionChip = { loinc: '11111-1', name: 'Glucose', unit: 'mg/dL' };
    expect(getUnitLabel(plain, [plain])).toBe('');
    const unitless: SuggestionChip = { loinc: aliasCode, name: 'Variant' };
    expect(getUnitLabel(unitless, [unitless])).toBe('');
  });
});

describe('save button', () => {
  it('greys out and blocks the pointer while errors stand, and reports progress in its label', () => {
    expect(saveButtonStyle(true)).toMatchObject({ backgroundColor: COLOR.border, cursor: 'not-allowed', opacity: 0.5 });
    expect(saveButtonStyle(false)).toMatchObject({ backgroundColor: COLOR.accent, cursor: 'pointer', opacity: 1 });
    expect(saveButtonLabel(true)).toBe('Saving...');
    expect(saveButtonLabel(false)).toBe('Save');
  });
});
