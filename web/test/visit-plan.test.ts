import { describe, it, expect } from 'vitest';
import { quoteSchedule, type Laboratory } from '../src/data/labPricing';
import { planCells, planRows, type PlanCell } from '../src/data/visitPlan';

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
  it('orders rows by full name', () => {
    expect(planRows(['2093-3', '2085-9'])).toEqual(['2093-3', '2085-9']);
    expect(planRows(['2085-9', '2093-3'])).toEqual(['2093-3', '2085-9']);
  });
});
