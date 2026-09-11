import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ControlsEnabled, ViewSettings } from './ui';
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
  enabled: ControlsEnabled;
};

const NOT_IN_PANEL_DETAIL = 'You are already viewing one panel — filtering by panel applies in All Observations.';
const NO_PANELS = 'No monitoring panels to filter by.';
const UNIT_SYSTEM_OFF = 'The unit system applies to the Results and “What’s in range” tabs.';
const SAMPLE_LIMIT_OFF = 'The number of samplings shown applies to the Results tab.';
const FILTERS_OFF = 'The row filters apply to the Results tab.';

const SAMPLE_LIMITS: readonly (number | 'all')[] = [5, 10, 15, 'all'];

// The tooltip hangs on the group, not the control: a disabled control receives
// no mouse events, so a title on it would never show.
function ControlGroup({
  label,
  disabled,
  reason,
  children,
}: Readonly<{ label: string; disabled: boolean; reason: string | undefined; children: ReactNode }>) {
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
  enabled,
}: Readonly<ControlsBarProps>) {
  const panelOptions = panelFilter?.options ?? [];
  const panelDisabled = !enabled.filters || !panelFilter || panelOptions.length === 0;
  // Where the view and the tab both disable the picker, the view's reason wins:
  // it is the one that stays true after switching back to Results.
  let panelReason: string | undefined;
  if (!panelFilter) panelReason = NOT_IN_PANEL_DETAIL;
  else if (panelOptions.length === 0) panelReason = NO_PANELS;
  else if (!enabled.filters) panelReason = FILTERS_OFF;

  return (
    <div className="mc-controls">
      <ControlGroup label="Unit system" disabled={!enabled.unitSystem} reason={UNIT_SYSTEM_OFF}>
        <SegmentedControl
          label="Unit system"
          options={['si', 'us'] as const}
          value={unitSystem}
          onChange={setUnitSystem}
          disabled={!enabled.unitSystem}
          format={(sys) => sys.toUpperCase()}
        />
      </ControlGroup>
      <ControlGroup label="Last N samplings" disabled={!enabled.sampleLimit} reason={SAMPLE_LIMIT_OFF}>
        <SegmentedControl<number | 'all'>
          label="Last N samplings"
          options={SAMPLE_LIMITS}
          value={sampleLimit}
          onChange={setSampleLimit}
          disabled={!enabled.sampleLimit}
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
      <ControlGroup label="Find a marker" disabled={!enabled.filters} reason={FILTERS_OFF}>
        <label className="mc-field mc-field-search" data-disabled={!enabled.filters || undefined}>
          <Search size={15} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            aria-label="Filter observations by name"
            placeholder="HGB, Hemoglobin, 718-7…"
            disabled={!enabled.filters}
            value={markerQuery.value}
            onChange={(e) => markerQuery.onChange(e.currentTarget.value)}
          />
        </label>
      </ControlGroup>
    </div>
  );
}
