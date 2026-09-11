import { useEffect, useRef } from 'react';
import { formatScheduleMonth, monthChoices, type SelectionState } from './scheduled';
import { COLOR } from '../../styles/tokens';

const NO_MONTH = '';
const MONTHS_AHEAD = 23;


export type ScheduleHeaderProps = {
  /** The table this header sits on, for the select-all box's accessible name. */
  label: string;
  month: string | undefined;
  onSetMonth: (month: string | undefined) => void;
  state: SelectionState;
  /** Set when the table shows no observation rows, leaving select-all nothing to act on. */
  disabled?: boolean;
  onToggleAll: (on: boolean) => void;
};

/**
 * The Scheduled column's header: the schedule's target month plus a tri-state
 * select-all over the observation rows the table is currently showing -- index
 * rows are left to follow their inputs. The select and the box carry no visible
 * text, so they name themselves through aria-label.
 */
export function ScheduleHeader({ label, month, onSetMonth, state, disabled, onToggleAll }: Readonly<ScheduleHeaderProps>) {
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
        className="mc-field mc-field-select mc-field-sm"
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
        disabled={disabled}
        onChange={(e) => onToggleAll(e.currentTarget.checked)}
        aria-label={`Schedule every observation shown in ${label}`}
        style={{ width: 15, height: 15, margin: 0, accentColor: COLOR.primary, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
    </div>
  );
}
