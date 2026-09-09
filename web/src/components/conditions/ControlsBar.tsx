import type { ControlsEnabled, ViewSettings } from './ui';

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

const PILL_INSET = 12;
const CHEVRON_WIDTH = 10;

const PILL = {
  border: '1.5px solid #1971c2',
  borderRadius: 9999,
  padding: `4px ${PILL_INSET}px`,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  lineHeight: '18px',
  color: '#1971c2',
  backgroundColor: 'transparent',
} as const;

const TOGGLE_PILL = { ...PILL, cursor: 'pointer' } as const;

const PILL_DISABLED = { ...PILL, border: '1.5px solid #ccc', color: '#aaa', cursor: 'not-allowed' } as const;

// A disabled pill keeps showing which option is selected -- filled grey rather
// than filled blue, so the state survives without reading as live.
function togglePill(selected: boolean, disabled: boolean) {
  if (disabled) return { ...PILL_DISABLED, background: selected ? '#eee' : 'transparent' };
  return {
    ...TOGGLE_PILL,
    background: selected ? '#1971c2' : 'transparent',
    color: selected ? '#fff' : '#1971c2',
  };
}

const chevron = (stroke: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1L5 5L9 1' fill='none' stroke='%23${stroke}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

// A native select draws its own indicator against the padding box using metrics
// that assume a squared-off control, so under a 9999px radius it landed inside
// the pill's curve. The arrow is drawn here instead: appearance:none drops the
// UA one (all three spellings, so no engine paints both), and the background
// position places it PILL_INSET from the border box -- the same inset the label
// text gets on the left -- and vertically centred whatever the option's length.
const PANEL_SELECT = {
  ...PILL,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  paddingRight: PILL_INSET * 2 + CHEVRON_WIDTH,
  backgroundImage: chevron('1971c2'),
  backgroundRepeat: 'no-repeat',
  backgroundPosition: `right ${PILL_INSET}px center`,
  cursor: 'pointer',
} as const;

const PANEL_SELECT_DISABLED = {
  ...PANEL_SELECT,
  border: '1.5px solid #ccc',
  color: '#aaa',
  backgroundImage: chevron('aaaaaa'),
  cursor: 'not-allowed',
} as const;

const FILTER_INPUT = { ...PILL, width: 220, maxWidth: '100%', outline: 'none' } as const;

const FILTER_INPUT_DISABLED = { ...FILTER_INPUT, ...PILL_DISABLED, width: 220, maxWidth: '100%' } as const;

const GROUP_LABEL = { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 } as const;

const groupLabel = (disabled: boolean) => ({ ...GROUP_LABEL, color: disabled ? '#bbb' : '#888' });

const NOT_IN_PANEL_DETAIL = 'You are already viewing one panel — filtering by panel applies in All Observations.';
const NO_PANELS = 'No monitoring panels to filter by.';
const UNIT_SYSTEM_OFF = 'The unit system applies to the Results and “What’s in range” tabs.';
const SAMPLE_LIMIT_OFF = 'The number of samplings shown applies to the Results tab.';
const FILTERS_OFF = 'The row filters apply to the Results tab.';

function PillGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  reason,
  format,
}: Readonly<{
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
  reason: string;
  format: (v: T) => string;
}>) {
  return (
    // The tooltip hangs on the group, not the buttons: a disabled control
    // receives no mouse events, so a title on it would never show.
    <div title={disabled ? reason : undefined}>
      <div style={groupLabel(disabled)}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            style={togglePill(value === option, disabled)}
          >
            {format(option)}
          </button>
        ))}
      </div>
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
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 32, rowGap: 16, marginBottom: 20 }}>
      <PillGroup
        label="Unit system"
        options={['si', 'us'] as const}
        value={unitSystem}
        onChange={setUnitSystem}
        disabled={!enabled.unitSystem}
        reason={UNIT_SYSTEM_OFF}
        format={(sys) => sys.toUpperCase()}
      />
      <PillGroup
        label="Last N samplings"
        options={[5, 10, 15, 'all'] as const}
        value={sampleLimit}
        onChange={setSampleLimit}
        disabled={!enabled.sampleLimit}
        reason={SAMPLE_LIMIT_OFF}
        format={(n) => (n === 'all' ? 'All' : String(n))}
      />
      <div title={panelReason}>
        <div style={groupLabel(panelDisabled)}>Show observations from</div>
        <select
          aria-label="Filter observations by monitoring panel"
          disabled={panelDisabled}
          value={panelFilter?.value ?? ALL_PANELS}
          onChange={(e) => panelFilter?.onChange(e.currentTarget.value)}
          style={panelDisabled ? PANEL_SELECT_DISABLED : PANEL_SELECT}
        >
          <option value={ALL_PANELS}>All panels</option>
          {panelOptions.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <div title={enabled.filters ? undefined : FILTERS_OFF}>
        <div style={groupLabel(!enabled.filters)}>Find a marker</div>
        <input
          type="search"
          aria-label="Filter observations by name"
          placeholder="HGB, Гемоглобин, 718-7…"
          disabled={!enabled.filters}
          value={markerQuery.value}
          onChange={(e) => markerQuery.onChange(e.currentTarget.value)}
          style={enabled.filters ? FILTER_INPUT : FILTER_INPUT_DISABLED}
        />
      </div>
    </div>
  );
}
