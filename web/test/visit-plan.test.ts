import { describe, it, expect } from 'vitest';
import { quoteSchedule, type Laboratory } from '../src/data/labPricing';
import { planCells, planRowLabel, planRows, type PlanCell } from '../src/data/visitPlan';

const lab: Laboratory = {
  id: 'test-lab',
  name: 'Test lab',
  locale: 'uk-UA',
  currency: 'UAH',
  pricesAsOf: '2026-09-10',
  prices: [
    { label: 'TC', price: 167, covers: ['2093-3'] },
    { label: 'HDL-C', price: 167.5, covers: ['2085-9'] },
    { label: 'FBC', price: 328, covers: ['6690-2', '718-7', '777-3'] },
  ],
};

const show = (cells: PlanCell[]) => cells.map((c) => (c.kind === 'unpriced' ? '—' : `${c.kind}:${c.line.label}`));
const pricedSum = (cells: PlanCell[]) =>
  cells.reduce((sum, c) => sum + (c.kind === 'priced' ? Math.round(c.line.price * 100) : 0), 0) / 100;

describe('planCells', () => {
  it('prices plain rows on their own line', () => {
    expect(show(planCells(['2093-3', '2085-9'], lab))).toEqual(['priced:TC', 'priced:HDL-C']);
  });

  it('shows a bundle price once, on its first covered row', () => {
    const rows = ['718-7', '2093-3', '6690-2', '777-3'];
    const cells = planCells(rows, lab);
    expect(show(cells)).toEqual(['priced:FBC', 'priced:TC', 'bundled:FBC', 'bundled:FBC']);
    expect(pricedSum(cells)).toBe(quoteSchedule(rows, lab).total);
  });

  it('leaves a row no line covers unpriced', () => {
    const cells = planCells(['2093-3', '1742-6'], lab);
    expect(show(cells)).toEqual(['priced:TC', '—']);
    expect(quoteSchedule(['2093-3', '1742-6'], lab).unpriced).toEqual(['1742-6']);
  });

  it('folds an alias-coded scheduled row into its primary row and price', () => {
    const rows = planRows(['14647-2', '2093-3']);
    expect(rows).toEqual(['2093-3']);
    expect(show(planCells(rows, lab))).toEqual(['priced:TC']);
    expect(show(planCells(['14647-2'], lab))).toEqual(['priced:TC']);
  });
});

describe('planRows', () => {
  it('orders rows by LOINC name', () => {
    expect(planRows(['2093-3', '2085-9'])).toEqual(['2093-3', '2085-9']);
    expect(planRows(['2085-9', '2093-3'])).toEqual(['2093-3', '2085-9']);
  });
});

describe('planRowLabel', () => {
  const genericLabel = 'Total Cholesterol (TC)';

  it('shows the generic name when no laboratory is selected', () => {
    expect(planRowLabel(undefined, genericLabel)).toEqual({ text: genericLabel, isFallback: false });
  });

  it("shows the laboratory's own name and link when it prices the row", () => {
    const [cell] = planCells(['2093-3'], { ...lab, prices: [{ label: 'TC', price: 167, covers: ['2093-3'], url: 'https://lab.example/tc' }] });
    expect(planRowLabel(cell!, genericLabel)).toEqual({ text: 'TC', url: 'https://lab.example/tc', isFallback: false });
  });

  it("shows the laboratory's own name with no link when the price line carries none", () => {
    const [cell] = planCells(['2093-3'], lab);
    expect(planRowLabel(cell!, genericLabel)).toEqual({ text: 'TC', url: undefined, isFallback: false });
  });

  it('shows the same name for a bundled row, taken from the bundle line', () => {
    const rows = ['718-7', '6690-2'];
    const [, bundled] = planCells(rows, lab);
    expect(planRowLabel(bundled!, genericLabel)).toEqual({ text: 'FBC', url: undefined, isFallback: false });
  });

  it('falls back to the generic name, flagged, when the selected laboratory does not price the row', () => {
    const [cell] = planCells(['1742-6'], lab);
    expect(planRowLabel(cell!, genericLabel)).toEqual({ text: genericLabel, isFallback: true });
  });
});
