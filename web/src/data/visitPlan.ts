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

/** What a row's Observation cell should display for one laboratory. */
export type PlanRowLabel = { text: string; url?: string; isFallback: boolean };

/**
 * With no laboratory selected (`cell` undefined) a row shows the app's own
 * generic name. Once one is selected, a row it prices shows that laboratory's
 * own product name (linked when the price line carries a `url`); a row it
 * does not price falls back to the generic name, flagged so that fallback
 * reads as "not this lab's own name" rather than as the lab's own choice.
 */
export function planRowLabel(cell: PlanCell | undefined, genericLabel: string): PlanRowLabel {
  if (!cell) return { text: genericLabel, isFallback: false };
  if (cell.kind === 'unpriced') return { text: genericLabel, isFallback: true };
  const { label, innerId, url } = cell.line;
  return { text: innerId ? `${innerId} · ${label}` : label, url, isFallback: false };
}
