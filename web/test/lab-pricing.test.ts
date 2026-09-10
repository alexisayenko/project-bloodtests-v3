import { describe, it, expect } from 'vitest';
import { LABORATORY_BY_ID, formatPrice, quoteSchedule, type Laboratory } from '../src/data/labPricing';
import { ALIAS_TO_PRIMARY } from '../src/data/analyteCatalog';
import { PANELS } from './dataFiles';

const lab: Laboratory = {
  id: 'test-lab',
  name: 'Test lab',
  locale: 'uk-UA',
  currency: 'UAH',
  pricesAsOf: '2026-09-10',
  prices: [
    { label: 'TC', price: 167, covers: ['2093-3'] },
    { label: 'TC express', price: 250, covers: ['2093-3'] },
    { label: 'HDL-C', price: 167.5, covers: ['2085-9'] },
    { label: 'FBC', price: 328, covers: ['6690-2', '718-7', '777-3'] },
    { label: 'Glucose', price: 189, covers: ['2345-7', '2339-0'] },
  ],
};

const labels = (loincs: string[]) => quoteSchedule(loincs, lab).charged.map((line) => line.label);

describe('quoteSchedule', () => {
  it('totals an empty schedule at zero', () => {
    expect(quoteSchedule([], lab)).toEqual({ total: 0, currency: 'UAH', charged: [], unpriced: [] });
  });

  it('sums single tests', () => {
    expect(quoteSchedule(['2093-3', '2085-9'], lab).total).toBe(334.5);
    expect(labels(['2093-3', '2085-9'])).toEqual(['TC', 'HDL-C']);
  });

  it('takes the cheapest line covering a code', () => {
    expect(labels(['2093-3'])).toEqual(['TC']);
  });

  it('charges a bundle once however many of its codes are scheduled', () => {
    const quote = quoteSchedule(['6690-2', '718-7', '777-3'], lab);
    expect(quote.total).toBe(328);
    expect(quote.charged.map((line) => line.label)).toEqual(['FBC']);
  });

  it('lets an ambiguous line satisfy either of its codes, once', () => {
    expect(quoteSchedule(['2345-7'], lab).total).toBe(189);
    expect(quoteSchedule(['2339-0'], lab).total).toBe(189);
    expect(quoteSchedule(['2345-7', '2339-0'], lab).total).toBe(189);
  });

  it('matches a molar-coded row to its mass-coded price', () => {
    expect(ALIAS_TO_PRIMARY['14647-2']).toBe('2093-3');
    expect(ALIAS_TO_PRIMARY['14749-6']).toBe('2345-7');
    expect(quoteSchedule(['14647-2'], lab).total).toBe(167);
    expect(quoteSchedule(['14749-6', '2345-7'], lab).total).toBe(189);
  });

  it('reports unpriced codes, folded and once each, rather than dropping them', () => {
    const quote = quoteSchedule(['2093-3', '1742-6', '1975-2', '14631-6'], lab);
    expect(quote.total).toBe(167);
    expect(quote.unpriced).toEqual(['1742-6', '1975-2']);
  });

  it("costs Esculab's full blood count once beside its glucose", () => {
    const esculab = LABORATORY_BY_ID.esculab!;
    const fbc = PANELS.find((p) => p.id === 'fbc')!.sections!.flatMap((s) => s.loincs);
    const quote = quoteSchedule([...fbc, '2339-0', '14749-6', '11580-8'], esculab);
    expect(quote.charged.map((line) => line.label)).toEqual(['FBC', 'Glucose']);
    expect(quote.total).toBe(517);
    expect(quote.unpriced).toEqual(['11580-8']);
  });
});

describe('formatPrice', () => {
  it("groups digits the laboratory's way and names the currency", () => {
    expect(formatPrice(1234, lab).replace(/\s/g, ' ')).toBe('1 234 UAH');
    expect(formatPrice(517, lab)).toBe('517 UAH');
  });
});
