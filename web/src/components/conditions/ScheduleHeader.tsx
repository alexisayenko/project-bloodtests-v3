import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { monthChoices, type SelectionState } from './scheduled';
import { formatMonthFullYear } from '../../data/months';
import { COLOR } from '../../styles/tokens';

const NO_MONTH = '';
const MONTHS_AHEAD = 23;

export type MonthSelectProps = {
  /** Accessible name -- the select carries no visible label of its own. */
  ariaLabel: string;
  month: string | undefined;
  onSetMonth: (month: string | undefined) => void;
};

/** A visit's target-month picker: this month plus the next 23, styled as a small inline field. Shared by ScheduleHeader (in a results table) and PlanVisitView (in the "Planned for" pill), so both edit the same underlying month. */
export function MonthSelect({ ariaLabel, month, onSetMonth }: Readonly<MonthSelectProps>) {
  return (
    <select
      aria-label={ariaLabel}
      value={month ?? NO_MONTH}
      onChange={(e) => onSetMonth(e.currentTarget.value || undefined)}
      className="mc-field mc-field-select mc-field-sm"
    >
      <option value={NO_MONTH}>No month</option>
      {monthChoices(new Date(), MONTHS_AHEAD, month).map((m) => (
        <option key={m} value={m}>
          {formatMonthFullYear(m)}
        </option>
      ))}
    </select>
  );
}

export type ScheduleHeaderProps = {
  /** The table this header sits on, for the select-all box's accessible name. */
  label: string;
  month: string | undefined;
  onSetMonth: (month: string | undefined) => void;
  state: SelectionState;
  /** Set when the table shows no observation rows, leaving select-all nothing to act on. */
  disabled?: boolean;
  onToggleAll: (on: boolean) => void;
  /** Drops this whole visit -- every row and index it had scheduled. */
  onRemove: () => void;
};

/**
 * One scheduled visit's column header: its target month, a tri-state
 * select-all over the observation rows the table is currently showing -- index
 * rows are left to follow their inputs -- and a remove button for the visit
 * itself. The select and the box carry no visible text, so they name
 * themselves through aria-label.
 */
export function ScheduleHeader({ label, month, onSetMonth, state, disabled, onToggleAll, onRemove }: Readonly<ScheduleHeaderProps>) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = state === 'some';
  }, [state]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <MonthSelect ariaLabel="Month this visit is planned for" month={month} onSetMonth={onSetMonth} />
      <input
        ref={box}
        type="checkbox"
        checked={state === 'all'}
        disabled={disabled}
        onChange={(e) => onToggleAll(e.currentTarget.checked)}
        aria-label={`Schedule every observation shown in ${label}`}
        style={{ width: 15, height: 15, margin: 0, accentColor: COLOR.primary, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this scheduled visit"
        title="Remove this scheduled visit"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          padding: 0,
          border: 'none',
          background: 'none',
          color: COLOR.textMuted,
          cursor: 'pointer',
        }}
      >
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
