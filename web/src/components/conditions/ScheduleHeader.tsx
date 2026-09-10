import { useContext, useEffect, useRef } from 'react';
import { formatScheduleMonth, monthChoices, ScheduleLabContext, type SelectionState } from './scheduled';
import { LABORATORIES, LABORATORY_BY_ID, formatPrice, quoteSchedule } from '../../data/labPricing';
import { SHORT_LABELS } from '../../data/analyteCatalog';
import { COLOR } from '../../styles/tokens';

const NO_MONTH = '';
const NO_LAB = '';
const MONTHS_AHEAD = 23;

// Mirrors the filter pills in AllObservationsView (same border, radius and blue)
// at the smaller type the column header has room for. Kept local rather than
// imported from there: that module already imports this table, so sharing the
// constant would close an import cycle.
const PILL = {
  border: `1.5px solid ${COLOR.accent}`,
  borderRadius: 9999,
  padding: '1px 8px',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  lineHeight: '16px',
  color: COLOR.accent,
  backgroundColor: 'transparent',
} as const;

const PILL_SELECT = {
  ...PILL,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  paddingRight: 24,
  // Same reason as the panel filter's chevron: a native select draws its
  // indicator with squared-off metrics, which lands inside a 9999px radius.
  backgroundImage: COLOR.chevronAccent,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  cursor: 'pointer',
  maxWidth: '100%',
} as const;

const TOTAL_LINE = {
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 600,
  color: COLOR.text,
} as const;

const UNPRICED_LINE = { ...TOTAL_LINE, fontSize: 11, lineHeight: '14px', fontWeight: 400, color: COLOR.textMuted } as const;

export type ScheduleHeaderProps = {
  /** The table this header sits on, for the select-all box's accessible name. */
  label: string;
  month: string | undefined;
  onSetMonth: (month: string | undefined) => void;
  state: SelectionState;
  onToggleAll: (on: boolean) => void;
};

function LabTotal({ labId, loincs }: Readonly<{ labId: string; loincs: string[] }>) {
  const lab = LABORATORY_BY_ID[labId];
  if (!lab) return null;
  const quote = quoteSchedule(loincs, lab);
  const breakdown = quote.charged.map((line) => `${line.label}: ${formatPrice(line.price, lab)}`);
  return (
    <>
      <div style={TOTAL_LINE} title={[`${lab.name}, prices as of ${lab.pricesAsOf}`, ...breakdown].join('\n')}>
        {formatPrice(quote.total, lab)}
      </div>
      {quote.unpriced.length > 0 && (
        <div style={UNPRICED_LINE} title={quote.unpriced.map((code) => SHORT_LABELS[code]?.short ?? code).join(', ')}>
          {quote.unpriced.length} not priced
        </div>
      )}
    </>
  );
}

/**
 * The Scheduled column's header: the schedule's target month plus a tri-state
 * select-all over the rows the table is currently showing, and beneath them the
 * laboratory the whole schedule is costed at with its total. The selects and
 * the box carry no visible text, so they name themselves through aria-label.
 */
export function ScheduleHeader({ label, month, onSetMonth, state, onToggleAll }: Readonly<ScheduleHeaderProps>) {
  const box = useRef<HTMLInputElement>(null);
  const scheduleLab = useContext(ScheduleLabContext);
  useEffect(() => {
    if (box.current) box.current.indeterminate = state === 'some';
  }, [state]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <select
          aria-label="Month these tests are planned for"
          value={month ?? NO_MONTH}
          onChange={(e) => onSetMonth(e.currentTarget.value || undefined)}
          style={PILL_SELECT}
        >
          <option value={NO_MONTH}>No month</option>
          {monthChoices(new Date(), MONTHS_AHEAD, month).map((m) => (
            <option key={m} value={m}>
              {formatScheduleMonth(m)}
            </option>
          ))}
        </select>
        <input
          ref={box}
          type="checkbox"
          checked={state === 'all'}
          onChange={(e) => onToggleAll(e.currentTarget.checked)}
          aria-label={`Schedule every row shown in ${label}`}
          style={{ margin: 0, accentColor: COLOR.accent, cursor: 'pointer' }}
        />
      </div>
      {scheduleLab && (
        <>
          <select
            aria-label="Laboratory to price the scheduled tests at"
            value={scheduleLab.scheduled.lab ?? NO_LAB}
            onChange={(e) => scheduleLab.onSetLab(e.currentTarget.value || undefined)}
            style={PILL_SELECT}
          >
            <option value={NO_LAB}>No lab</option>
            {LABORATORIES.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
          {scheduleLab.scheduled.lab && (
            <LabTotal labId={scheduleLab.scheduled.lab} loincs={scheduleLab.scheduled.loincs} />
          )}
        </>
      )}
    </div>
  );
}
