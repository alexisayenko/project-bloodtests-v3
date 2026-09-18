// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { TrendsView } from '../src/components/conditions/TrendsView';
import type { Condition } from '../src/components/conditions/exploreModel';
import type { ResultEntry } from '../src/components/conditions/resultsLookup';
import type { Result } from '../src/types';
import { mount, unmount, q } from './helpers/render';

function makeResult(overrides: Partial<Result>): Result {
  return {
    loinc: '',
    rawName: '',
    section: '',
    value: null,
    rawValue: '',
    valueQualifier: '',
    unit: '',
    refText: '',
    refMin: null,
    refMax: null,
    method: '',
    ...overrides,
  };
}

// A synthetic observation whose primary LOINC ("99001-1") is reported alongside a
// companion/alias LOINC ("99002-2") -- the shape ADR/markers.ts's `also` refs use
// for e.g. Prolactin reported in ng/mL under a different code than the primary.
const conditions: Condition[] = [
  {
    name: 'Test Panel',
    tests: [
      {
        shortName: 'PRL',
        friendlyName: 'Prolactin',
        longCommonName: 'Prolactin',
        loinc: '99001-1',
        unit: 'mIU/L',
        also: [{ aliasLabel: 'ng/mL', loinc: '99002-2', longCommonName: 'Prolactin', unit: 'ng/mL' }],
      },
    ],
  },
];

const allResults: ResultEntry[] = [
  {
    loinc: '99001-1',
    date: '2024-01-01',
    place: 'Lab A',
    result: makeResult({ loinc: '99001-1', rawName: 'Prolactin', value: 300, rawValue: '300', unit: 'mIU/L', refMin: 40, refMax: 400 }),
  },
  {
    // Same analyte, reported under the alias/companion LOINC by a different lab.
    loinc: '99002-2',
    date: '2024-06-01',
    place: 'Lab B',
    result: makeResult({ loinc: '99002-2', rawName: 'Prolactin', value: 20, rawValue: '20', unit: 'ng/mL', refMin: 2, refMax: 20 }),
  },
];

describe('TrendsView alias/companion LOINC folding', () => {
  afterEach(unmount);

  it('includes a reading recorded under an alias LOINC in the observation table and cards', async () => {
    const container = await mount(createElement(TrendsView, { conditions, allResults }));

    // Result History Table: both the primary- and alias-coded readings should appear.
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    const loincCells = [...rows].map((r) => r.querySelector('td')?.nextElementSibling?.textContent ?? '');
    expect(loincCells.some((t) => t.includes('99001-1'))).toBe(true);
    expect(loincCells.some((t) => t.includes('99002-2'))).toBe(true);

    // Header count reflects both readings, not just the primary-coded one.
    expect(q(container, 'h3').parentElement?.textContent).toContain('Prolactin');
    const countBadge = [...container.querySelectorAll('span')].find((s) => /result/.test(s.textContent ?? ''));
    expect(countBadge?.textContent).toBe('2 results');

    // Summary card latest value is built from both readings too (newest wins: the alias-coded one).
    const nameLabel = q(container, '[title="Prolactin"]');
    const valueRow = nameLabel.nextElementSibling;
    expect(valueRow?.firstElementChild?.textContent).toBe('20');
  });
});
