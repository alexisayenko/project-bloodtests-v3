import { useState } from 'react';
import type { ScheduledVisit } from './scheduled';
import { MonthSelect } from './ScheduleHeader';
import { TabBar } from './TabBar';
import { LABORATORIES, formatPrice, quoteSchedule, type LabQuote, type Laboratory } from '../../data/labPricing';
import { planCells, planRows, planRowLabel, type PlanCell } from '../../data/visitPlan';
import { ANALYTE_BY_LOINC, ALSO_REFS, SHORT_NAMES } from '../../data/analyteCatalog';
import { formatMonthFullYear } from '../../data/months';
import type { Observation } from './markers';
import { pressable } from './ui';
import { CalendarCheck, Coins, CheckSquare } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { CARD_TABLE_TD, CARD_TABLE_TH, Card, EmptyState, TABLE, TABLE_CARD } from '../primitives';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';

/** A tab's label: the visit's own target month, or the same "No month" copy its own MonthSelect shows for that state. */
function visitTabLabel(visit: ScheduledVisit): string {
  return visit.month ? formatMonthFullYear(visit.month) : 'No month';
}

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
  if (lowest <= 0) return new Set();
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

/** Stop a click/keypress on a nested control (a lab's own link) from also firing the row's popup handler. */
function stopBubble(e: { stopPropagation: () => void }): void {
  e.stopPropagation();
}

/** One visit's own card: its target month, its rows, its per-lab prices and its own laboratory radio group. */
function VisitPlanCard({
  visit,
  index,
  onOpenPopup,
  onSelectLab,
  onSetMonth,
}: Readonly<{
  visit: ScheduledVisit;
  /** Distinguishes this visit's radio-button group from every other visit's, so picking a lab in one never touches another. */
  index: number;
  onOpenPopup?: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  onSelectLab: (labId: string | undefined) => void;
  onSetMonth: (month: string | undefined) => void;
}>) {
  const rows = planRows(visit.loincs);
  const cells = LABORATORIES.map((lab) => planCells(rows, lab));
  const quotes = LABORATORIES.map((lab) => quoteSchedule(visit.loincs, lab));
  const cheapest = cheapestLabIds(quotes);
  const selectedLabIndex = LABORATORIES.findIndex((lab) => lab.id === visit.selectedLabId);
  const labRadioGroup = `plan-visit-lab-${index}`;

  return (
    <section style={{ marginBottom: SPACE[6] }}>
      <div style={{ marginBottom: SPACE[3] }}>
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
          <span>Planned for</span>
          <MonthSelect ariaLabel={`Month visit ${index + 1} is planned for`} month={visit.month} onSetMonth={onSetMonth} />
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState>
          Nothing is scheduled for this visit yet — tick rows in its Scheduled column of Monitoring Panels or All Observations.
        </EmptyState>
      ) : (
        <Card style={{ ...TABLE_CARD, width: 'fit-content', maxWidth: '100%' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...TABLE, fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={th}>
                    Observation
                    {selectedLabIndex >= 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectLab(undefined)}
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 400,
                          color: COLOR.textMuted,
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Show generic names
                      </button>
                    )}
                  </th>
                  <th style={gapTh} />
                  {LABORATORIES.map((lab) => (
                    <th key={lab.id} style={labTh} title={`Prices as of ${lab.pricesAsOf}`}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontWeight: 'inherit' }}>
                        {lab.name}
                        <input
                          type="radio"
                          name={labRadioGroup}
                          checked={visit.selectedLabId === lab.id}
                          onChange={() => onSelectLab(lab.id)}
                          title={`Show ${lab.name}'s own test names for this visit`}
                          style={{ width: 13, height: 13, margin: 0, accentColor: COLOR.primary, cursor: 'pointer' }}
                        />
                      </label>
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

                  const selectedCell = selectedLabIndex >= 0 ? cells[selectedLabIndex]![i] : undefined;
                  const rowLabel = planRowLabel(selectedCell, label);

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
                        {rowLabel.isFallback ? (
                          <span title="Not priced under its own name at this laboratory — showing the app's generic name" style={{ fontStyle: 'italic' }}>
                            {rowLabel.rest}
                          </span>
                        ) : (
                          <>
                            {rowLabel.link && (
                              <a
                                href={rowLabel.link.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={stopBubble}
                                onKeyDown={stopBubble}
                                style={{ color: 'inherit' }}
                              >
                                {rowLabel.link.text}
                              </a>
                            )}
                            {rowLabel.rest}
                          </>
                        )}
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
    </section>
  );
}

/** What each scheduled visit's draw costs at each laboratory, row by row and in total -- one visit shown at a time, picked by tab. */
export function PlanVisitView({
  visits,
  onOpenPopup,
  onSelectLab,
  onSetMonth,
}: Readonly<{
  visits: ScheduledVisit[];
  onOpenPopup?: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  onSelectLab: (visitId: string, labId: string | undefined) => void;
  onSetMonth: (visitId: string, month: string | undefined) => void;
}>) {
  // Page-navigation state, not a stored preference -- and visits are added/removed
  // dynamically, so a stale id is expected and simply falls back below rather than
  // being treated as an error.
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const activeIndex = visits.findIndex((v) => v.id === selectedId);
  const activeVisit = activeIndex >= 0 ? visits[activeIndex] : visits[0];
  const activeVisitIndex = activeIndex >= 0 ? activeIndex : 0;

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
      {visits.length === 0 || !activeVisit ? (
        <EmptyState>
          Nothing is scheduled yet — tick rows in the Scheduled column of Monitoring Panels or All Observations, or add a
          visit there with the + button next to it.
        </EmptyState>
      ) : (
        <>
          {visits.length > 1 && (
            <TabBar
              tabs={visits.map((visit) => ({ id: visit.id, label: visitTabLabel(visit) }))}
              active={activeVisit.id}
              onChange={setSelectedId}
            />
          )}
          <VisitPlanCard
            key={activeVisit.id}
            visit={activeVisit}
            index={activeVisitIndex}
            onOpenPopup={onOpenPopup}
            onSelectLab={(labId) => onSelectLab(activeVisit.id, labId)}
            onSetMonth={(month) => onSetMonth(activeVisit.id, month)}
          />
        </>
      )}
    </>
  );
}
