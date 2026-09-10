import laboratories from '../../public/data/laboratories.json';
import { ALIAS_TO_PRIMARY } from './analyteCatalog';

export type PriceLine = { label: string; price: number; covers: string[]; panelId?: string; note?: string };
export type Laboratory = {
  id: string;
  name: string;
  locale: string;
  currency: string;
  pricesAsOf: string;
  source?: string;
  prices: PriceLine[];
};

export const LABORATORIES = laboratories as Laboratory[];
export const LABORATORY_BY_ID: Readonly<Record<string, Laboratory>> = Object.fromEntries(
  LABORATORIES.map((lab) => [lab.id, lab])
);

export type LabQuote = {
  total: number;
  currency: string;
  /** Each price line charged, once, in the laboratory's own order. */
  charged: PriceLine[];
  /** Scheduled codes, folded to their primary, that no price line covers. */
  unpriced: string[];
};

function primaryOf(loinc: string): string {
  return ALIAS_TO_PRIMARY[loinc] ?? loinc;
}

/**
 * Costs a schedule at one laboratory: each scheduled code, folded to its
 * primary, takes the cheapest line covering it, and a line covering several
 * scheduled codes is still charged once. This is per-code cheapest, not the
 * cheapest combination of lines overall.
 */
export function quoteSchedule(loincs: readonly string[], lab: Laboratory): LabQuote {
  const cheapest = new Map<string, PriceLine>();
  for (const line of lab.prices) {
    for (const code of new Set(line.covers.map(primaryOf))) {
      const best = cheapest.get(code);
      if (!best || line.price < best.price) cheapest.set(code, line);
    }
  }
  const chosen = new Set<PriceLine>();
  const unpriced: string[] = [];
  for (const code of new Set(loincs.map(primaryOf))) {
    const line = cheapest.get(code);
    if (line) chosen.add(line);
    else unpriced.push(code);
  }
  const charged = lab.prices.filter((line) => chosen.has(line));
  const cents = charged.reduce((sum, line) => sum + Math.round(line.price * 100), 0);
  return { total: cents / 100, currency: lab.currency, charged, unpriced };
}

export function formatPrice(amount: number, lab: Laboratory): string {
  return `${new Intl.NumberFormat(lab.locale, { maximumFractionDigits: 2 }).format(amount)} ${lab.currency}`;
}
