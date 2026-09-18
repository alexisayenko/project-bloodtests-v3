import { ANALYTE_BY_LOINC } from './analyteCatalog';
import { cheapestLineByCode, primaryOf, type Laboratory, type PriceLine } from './labPricing';

/** `bundled`: an earlier row already shows this line's price. */
export type PlanCell =
  | { kind: 'priced'; line: PriceLine }
  | { kind: 'bundled'; line: PriceLine }
  | { kind: 'unpriced' };

/** Folded to primary codes, once each, sorted by LOINC name. */
export function planRows(loincs: readonly string[]): string[] {
  const name = (code: string) => ANALYTE_BY_LOINC[code]?.longCommonName ?? code;
  return [...new Set(loincs.map(primaryOf))].sort((a, b) => name(a).localeCompare(name(b)) || a.localeCompare(b));
}

/** Must mirror `quoteSchedule`, so a column's priced cells sum to its quote. */
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

export type PlanRowLabel = { link?: { text: string; url: string }; rest: string; isFallback: boolean };

// `isFallback` marks a generic name shown because the selected lab does not
// price the row, as distinct from no lab being selected at all.
export function planRowLabel(cell: PlanCell | undefined, genericLabel: string): PlanRowLabel {
  if (!cell) return { rest: genericLabel, isFallback: false };
  if (cell.kind === 'unpriced') return { rest: genericLabel, isFallback: true };
  const { label, innerId, url } = cell.line;
  if (innerId && url) return { link: { text: innerId, url }, rest: ` · ${label}`, isFallback: false };
  if (url) return { link: { text: label, url }, rest: '', isFallback: false };
  return { rest: innerId ? `${innerId} · ${label}` : label, isFallback: false };
}
