import { useEffect, useRef } from 'react';
import { formatScheduleMonth, monthChoices, type SelectionState } from './scheduled';

const NO_MONTH = '';
const MONTHS_AHEAD = 23;

// Mirrors the filter pills in AllObservationsView (same border, radius and blue)
// at the smaller type the column header has room for. Kept local rather than
// imported from there: that module already imports this table, so sharing the
// constant would close an import cycle.
const PILL = {
  border: '1.5px solid #1971c2',
  borderRadius: 9999,
  padding: '1px 8px',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  lineHeight: '16px',
  color: '#1971c2',
  backgroundColor: 'transparent',
} as const;

// Same reason as the panel filter's chevron: a native select draws its
// indicator with squared-off metrics, which lands inside a 9999px radius.
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1L5 5L9 1' fill='none' stroke='%231971c2' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

const MONTH_SELECT = {
  ...PILL,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  paddingRight: 24,
  backgroundImage: CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  cursor: 'pointer',
  maxWidth: '100%',
} as const;

export type ScheduleHeaderProps = {
  /** The table this header sits on, for the select-all box's accessible name. */
  label: string;
  month: string | undefined;
  onSetMonth: (month: string | undefined) => void;
  state: SelectionState;
  onToggleAll: (on: boolean) => void;
};

/**
 * The Scheduled column's header: the schedule's target month plus a tri-state
 * select-all over the rows the table is currently showing. Neither control
 * carries visible text, so both name themselves through aria-label.
 */
export function ScheduleHeader({ label, month, onSetMonth, state, onToggleAll }: Readonly<ScheduleHeaderProps>) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = state === 'some';
  }, [state]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <select
        aria-label="Month these tests are planned for"
        value={month ?? NO_MONTH}
        onChange={(e) => onSetMonth(e.currentTarget.value || undefined)}
        style={MONTH_SELECT}
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
        style={{ margin: 0, accentColor: '#1971c2', cursor: 'pointer' }}
      />
    </div>
  );
}
