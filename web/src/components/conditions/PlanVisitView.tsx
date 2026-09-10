import { formatScheduleMonth, type Scheduled } from './scheduled';
import { LABORATORIES, formatPrice, quoteSchedule, type Laboratory } from '../../data/labPricing';
import { planCells, planRows, type PlanCell } from '../../data/visitPlan';
import { ANALYTE_BY_LOINC, SHORT_LABELS } from '../../data/analyteCatalog';
import { COLOR } from '../../styles/tokens';

const GAP_COL_WIDTH = 16;
const LAB_COL_WIDTH = 120;

const th = {
  textAlign: 'left',
  padding: '8px 12px',
  verticalAlign: 'bottom',
  borderBottom: `1.5px solid ${COLOR.accent}`,
  whiteSpace: 'nowrap',
} as const;
const td = { padding: '8px 12px', borderBottom: `1px solid ${COLOR.borderSubtle}`, whiteSpace: 'nowrap', verticalAlign: 'top' } as const;
const labTh = { ...th, textAlign: 'right', width: LAB_COL_WIDTH } as const;
const labTd = { ...td, textAlign: 'right' } as const;
const gapCell = { padding: 0, border: 'none', width: GAP_COL_WIDTH } as const;
const totalTd = { ...labTd, borderTop: th.borderBottom, borderBottom: 'none', fontWeight: 600 } as const;
const muted = { color: COLOR.textMuted, fontSize: 12, fontWeight: 400 } as const;

function PriceCell({ cell, lab }: Readonly<{ cell: PlanCell; lab: Laboratory }>) {
  if (cell.kind === 'unpriced') return <td style={{ ...labTd, color: COLOR.textMuted }}>—</td>;
  if (cell.kind === 'bundled') return <td style={{ ...labTd, ...muted }}>in {cell.line.label}</td>;
  return (
    <td style={labTd} title={cell.line.note ?? cell.line.label}>
      {formatPrice(cell.line.price, lab)}
    </td>
  );
}

function TotalCell({ lab, loincs }: Readonly<{ lab: Laboratory; loincs: string[] }>) {
  const quote = quoteSchedule(loincs, lab);
  return (
    <td style={totalTd}>
      {formatPrice(quote.total, lab)}
      {quote.unpriced.length > 0 && (
        <div style={muted} title={quote.unpriced.map((code) => SHORT_LABELS[code]?.short ?? code).join(', ')}>
          {quote.unpriced.length} not priced
        </div>
      )}
    </td>
  );
}

/** What the scheduled draw costs at each laboratory, row by row and in total. */
export function PlanVisitView({ scheduled }: Readonly<{ scheduled: Scheduled }>) {
  const rows = planRows(scheduled.loincs);
  const cells = LABORATORIES.map((lab) => planCells(rows, lab));

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Plan Visit</h1>
      <div style={{ fontSize: 14, marginBottom: 16 }}>
        <span style={{ color: COLOR.textMuted }}>Planned for </span>
        <strong>{scheduled.month ? formatScheduleMonth(scheduled.month) : 'No month selected'}</strong>
      </div>
      {rows.length === 0 ? (
        <div style={{ color: COLOR.textMuted, fontSize: 14 }}>
          Nothing is scheduled yet — tick rows in the Scheduled column of Monitoring Panels or All Observations.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={th}>LOINC</th>
                <th style={th}>Full name</th>
                <th style={th}>Short name</th>
                <th style={gapCell} />
                {LABORATORIES.map((lab) => (
                  <th key={lab.id} style={labTh} title={`Prices as of ${lab.pricesAsOf}`}>
                    {lab.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((code, i) => (
                <tr key={code}>
                  <td style={td}>{code}</td>
                  <td style={{ ...td, whiteSpace: 'normal', minWidth: 240 }}>{ANALYTE_BY_LOINC[code]?.longCommonName ?? '—'}</td>
                  <td style={td}>{SHORT_LABELS[code]?.short ?? '—'}</td>
                  <td style={gapCell} />
                  {LABORATORIES.map((lab, l) => (
                    <PriceCell key={lab.id} cell={cells[l]![i]!} lab={lab} />
                  ))}
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={totalTd} />
                <td style={totalTd}>Total</td>
                <td style={gapCell} />
                {LABORATORIES.map((lab) => (
                  <TotalCell key={lab.id} lab={lab} loincs={scheduled.loincs} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
