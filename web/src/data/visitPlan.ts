import { ANALYTE_BY_LOINC } from './analyteCatalog';
import { cheapestLineByCode, primaryOf, type Laboratory, type PriceLine } from './labPricing';

/**
 * One row's cell in a laboratory's column: the line pricing it, or -- when an
 * earlier row already shows that line's price -- the bundle it rides in.
 */
export type PlanCell =
  | { kind: 'priced'; line: PriceLine }
  | { kind: 'bundled'; line: PriceLine }
  | { kind: 'unpriced' };

/** The scheduled codes as plan rows: folded to their primary, once each, by LOINC name. */
export function planRows(loincs: readonly string[]): string[] {
  const name = (code: string) => ANALYTE_BY_LOINC[code]?.longCommonName ?? code;
  return [...new Set(loincs.map(primaryOf))].sort((a, b) => name(a).localeCompare(name(b)) || a.localeCompare(b));
}

/**
 * Attributes each row to the line `quoteSchedule` charges for it, so the cells
 * a column shows as prices sum to that laboratory's quote.
 */
export function planCells(rows: readonly string[], lab: Laboratory): PlanCell[] {
  const cheapest = cheapestLineByCode(lab);
  const shown = new Set<PriceLine>();
  return rows.map((row) => {
    const line = cheapest.get(primaryOf(row));
    if (!line) return { kind: 'unpriced' };
    if (shown.has(line)) return { kind: 'bundled', line };
    shown.add(line);
    return { kind: 'priced', line };
  });
}
