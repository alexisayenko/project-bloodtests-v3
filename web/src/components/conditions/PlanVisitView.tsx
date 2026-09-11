import { formatScheduleMonth, type Scheduled } from './scheduled';
import { LABORATORIES, formatPrice, quoteSchedule, type LabQuote, type Laboratory } from '../../data/labPricing';
import { planCells, planRows, type PlanCell } from '../../data/visitPlan';
import { ANALYTE_BY_LOINC, ALSO_REFS, SHORT_NAMES } from '../../data/analyteCatalog';
import type { Observation } from './markers';
import { pressable } from './ui';
import { CalendarCheck, Coins, CheckSquare } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { CARD_TABLE_TD, CARD_TABLE_TH, Card, EmptyState, TABLE, TABLE_CARD } from '../primitives';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';

const GAP_COL_WIDTH = 16;
const LAB_COL_WIDTH = 120;

const th = { ...CARD_TABLE_TH, verticalAlign: 'bottom' } as const;
const td = { ...CARD_TABLE_TD, verticalAlign: 'top' } as const;
const labTh = { ...th, textAlign: 'right', width: LAB_COL_WIDTH } as const;
const labTd = { ...td, textAlign: 'right' } as const;
const gapCell = { padding: 0, border: 'none', width: GAP_COL_WIDTH } as const;
const gapTh = { ...gapCell, background: COLOR.surfaceMuted, borderBottom: `1px solid ${COLOR.borderSubtle}` } as const;
const totalTd = { ...labTd, borderBottom: 'none', fontWeight: 600, color: COLOR.navy } as const;
// A collapsed-border tie goes to the upper cell, so the rule above Total is drawn by the last data row.
const totalRule = { borderBottom: `1px solid ${COLOR.textSecondary}` } as const;
const muted = { color: COLOR.textMuted, fontSize: 12, fontWeight: 400 } as const;

/** The laboratories sharing the lowest total; empty when totals are in different currencies or there is nothing to compare. */
function cheapestLabIds(quotes: readonly LabQuote[]): Set<string> {
  if (quotes.length < 2 || new Set(quotes.map((q) => q.currency)).size > 1) return new Set();
  const lowest = Math.min(...quotes.map((q) => q.total));
  if (!(lowest > 0)) return new Set();
  return new Set(LABORATORIES.filter((_lab, i) => quotes[i]!.total === lowest).map((lab) => lab.id));
}

function PriceCell({ cell, lab, last }: Readonly<{ cell: PlanCell; lab: Laboratory; last: boolean }>) {
  const style = last ? { ...labTd, ...totalRule } : labTd;
  if (cell.kind === 'unpriced') return <td style={{ ...style, color: COLOR.textMuted }}>—</td>;
  if (cell.kind === 'bundled') return <td style={{ ...style, ...muted }}>in {cell.line.label}</td>;
  return (
    <td style={{ ...style, fontVariantNumeric: 'tabular-nums' }} title={cell.line.note ?? cell.line.label}>
      {formatPrice(cell.line.price, lab)}
    </td>
  );
}

function TotalCell({ lab, quote, cheapest }: Readonly<{ lab: Laboratory; quote: LabQuote; cheapest: boolean }>) {
  return (
    <td style={{ ...totalTd, padding: 8 }}>
      <div
        style={{
          padding: '4px 8px',
          borderRadius: RADIUS.control,
          fontVariantNumeric: 'tabular-nums',
          ...(cheapest ? { background: COLOR.statusOkBg, color: COLOR.statusOkText } : {}),
        }}
      >
        {formatPrice(quote.total, lab)}
        {cheapest && <div style={{ fontSize: 11, fontWeight: 500 }}>Cheapest</div>}
        {quote.unpriced.length > 0 && (
          <div style={muted} title={quote.unpriced.map((code) => SHORT_NAMES[code]?.shortName ?? code).join(', ')}>
            {quote.unpriced.length} not priced
          </div>
        )}
      </div>
    </td>
  );
}

/** What the scheduled draw costs at each laboratory, row by row and in total. */
export function PlanVisitView({
  scheduled,
  onOpenPopup,
}: Readonly<{
  scheduled: Scheduled;
  onOpenPopup?: (test: Observation, e: { currentTarget: HTMLElement }) => void;
}>) {
  const rows = planRows(scheduled.loincs);
  const cells = LABORATORIES.map((lab) => planCells(rows, lab));
  const quotes = LABORATORIES.map((lab) => quoteSchedule(scheduled.loincs, lab));
  const cheapest = cheapestLabIds(quotes);

  return (
    <>
      <PageHeader
        overline="Laboratory Draw Planner"
        titlePrimary="Scheduled"
        titleAccent="Visits"
        description={[
          'Plan upcoming diagnostic appointments and calculate expected laboratory prices.',
          'Select markers across panels to generate a complete ordering checklist.',
        ]}
        pillars={[
          { icon: CalendarCheck, line1: 'Target month', line2: 'draw planning' },
          { icon: Coins, line1: 'Transparent pricing', line2: 'by laboratory' },
          { icon: CheckSquare, line1: 'One-click test', line2: 'selection' },
        ]}
      />
      <div style={{ marginBottom: SPACE[4] }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: RADIUS.pill,
            background: COLOR.accentSoft,
            border: `1px solid ${COLOR.accentLine}`,
            fontSize: 13,
            color: COLOR.textSecondary,
          }}
        >
          <CalendarCheck size={14} color={COLOR.accent} strokeWidth={2} aria-hidden="true" />
          <span>Planned for</span>{' '}
          <strong style={{ color: COLOR.navy, fontWeight: 600 }}>
            {scheduled.month ? formatScheduleMonth(scheduled.month) : 'No month selected'}
          </strong>
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState>
          Nothing is scheduled yet — tick rows in the Scheduled column of Monitoring Panels or All Observations.
        </EmptyState>
      ) : (
        <Card style={{ ...TABLE_CARD, width: 'fit-content', maxWidth: '100%' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...TABLE, fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={th}>Observation</th>
                  <th style={gapTh} />
                  {LABORATORIES.map((lab) => (
                    <th key={lab.id} style={labTh} title={`Prices as of ${lab.pricesAsOf}`}>
                      {lab.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((code, i) => {
                  const last = i === rows.length - 1;
                  const a = ANALYTE_BY_LOINC[code];
                  const friendlyName = a?.friendlyName ?? code;
                  const shortName = SHORT_NAMES[code]?.shortName;
                  const label = shortName && shortName !== friendlyName ? `${friendlyName} (${shortName})` : friendlyName;

                  const observation: Observation = {
                    shortName: shortName ?? friendlyName,
                    friendlyName,
                    longCommonName: a?.longCommonName ?? '',
                    loinc: code,
                    unit: a?.unit,
                    also: ALSO_REFS[code],
                  };

                  return (
                    <tr key={code}>
                      <td
                        {...(onOpenPopup ? pressable((e) => onOpenPopup(observation, e)) : {})}
                        style={{
                          ...td,
                          ...(last ? totalRule : {}),
                          whiteSpace: 'normal',
                          minWidth: 240,
                          cursor: onOpenPopup ? 'pointer' : 'default',
                          fontWeight: 500,
                          color: COLOR.navy,
                        }}
                      >
                        {label}
                      </td>
                      <td style={gapCell} />
                      {LABORATORIES.map((lab, l) => (
                        <PriceCell key={lab.id} cell={cells[l]![i]!} lab={lab} last={last} />
                      ))}
                    </tr>
                  );
                })}
                <tr style={{ background: COLOR.surfaceMuted }}>
                  <td style={{ ...totalTd, textAlign: 'left', verticalAlign: 'middle' }}>Total</td>
                  <td style={gapCell} />
                  {LABORATORIES.map((lab, l) => (
                    <TotalCell key={lab.id} lab={lab} quote={quotes[l]!} cheapest={cheapest.has(lab.id)} />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
