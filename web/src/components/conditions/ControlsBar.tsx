import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ViewSettings } from './ui';
import { SegmentedControl } from '../primitives';

export type ControlsProps = ViewSettings & {
  setUnitSystem: (v: 'si' | 'us') => void;
  setSampleLimit: (v: number | 'all') => void;
};

export type PanelFilterControl = {
  options: readonly { name: string }[];
  value: string;
  onChange: (v: string) => void;
};

export type TextFilterControl = {
  value: string;
  onChange: (v: string) => void;
};

export type ControlsBarProps = ControlsProps & {
  /**
   * Omitted by Panel Detail, where the picker renders disabled rather than
   * absent: a control that vanishes between views makes the bar jump, and a
   * disabled one says the capability exists but you are already in one panel.
   */
  panelFilter?: PanelFilterControl;
  markerQuery: TextFilterControl;
};

const NOT_IN_PANEL_DETAIL = 'You are already viewing one panel — filtering by panel applies in All Observations.';
const NO_PANELS = 'No monitoring panels to filter by.';

const SAMPLE_LIMITS: readonly (number | 'all')[] = [5, 10, 15, 'all'];

// The tooltip hangs on the group, not the control: a disabled control receives
// no mouse events, so a title on it would never show.
function ControlGroup({
  label,
  disabled = false,
  reason,
  children,
}: Readonly<{ label: string; disabled?: boolean; reason?: string; children: ReactNode }>) {
  return (
    <div className="mc-control-group" title={disabled ? reason : undefined}>
      <div className="mc-control-label" data-disabled={disabled || undefined}>
        {label}
      </div>
      {children}
    </div>
  );
}

/** The panel picker's "no filter" value, shared with the view that holds the state. */
export const ALL_PANELS = '';

// Shared table controls -- unit system and samplings shown (one setting across
// the panel Analysis tables and All Observations alike), plus the two row
// filters, which are per-view session state passed in from the view.
export function ControlsBar({
  unitSystem,
  setUnitSystem,
  sampleLimit,
  setSampleLimit,
  panelFilter,
  markerQuery,
}: Readonly<ControlsBarProps>) {
  const panelOptions = panelFilter?.options ?? [];
  const panelDisabled = !panelFilter || panelOptions.length === 0;
  let panelReason: string | undefined;
  if (!panelFilter) panelReason = NOT_IN_PANEL_DETAIL;
  else if (panelOptions.length === 0) panelReason = NO_PANELS;

  return (
    <div className="mc-controls">
      <ControlGroup label="Unit system">
        <SegmentedControl
          label="Unit system"
          options={['si', 'us'] as const}
          value={unitSystem}
          onChange={setUnitSystem}
          format={(sys) => sys.toUpperCase()}
        />
      </ControlGroup>
      <ControlGroup label="Last N samplings">
        <SegmentedControl<number | 'all'>
          label="Last N samplings"
          options={SAMPLE_LIMITS}
          value={sampleLimit}
          onChange={setSampleLimit}
          format={(n) => (n === 'all' ? 'All' : String(n))}
        />
      </ControlGroup>
      <ControlGroup label="Show observations from" disabled={panelDisabled} reason={panelReason}>
        <select
          className="mc-field mc-field-select"
          aria-label="Filter observations by monitoring panel"
          disabled={panelDisabled}
          value={panelFilter?.value ?? ALL_PANELS}
          onChange={(e) => panelFilter?.onChange(e.currentTarget.value)}
        >
          <option value={ALL_PANELS}>All panels</option>
          {panelOptions.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </ControlGroup>
      <ControlGroup label="Find a marker">
        <label className="mc-field mc-field-search">
          <Search size={15} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            aria-label="Filter observations by name"
            placeholder="HGB, Hemoglobin, 718-7…"
            value={markerQuery.value}
            onChange={(e) => markerQuery.onChange(e.currentTarget.value)}
          />
        </label>
      </ControlGroup>
    </div>
  );
}
