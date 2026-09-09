import { pressable, type ViewSettings } from './ui';

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

const GROUP_LABEL = { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 } as const;

const NOT_IN_PANEL_DETAIL = 'You are already viewing one panel — filtering by panel applies in All Observations.';
const NO_PANELS = 'No monitoring panels to filter by.';

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
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 32, rowGap: 16, marginBottom: 20 }}>
      <div>
        <div style={GROUP_LABEL}>Unit system</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['si', 'us'] as const).map((sys) => (
            <div
              key={sys}
              {...pressable(() => setUnitSystem(sys))}
              style={{
                ...TOGGLE_PILL,
                background: unitSystem === sys ? '#1971c2' : 'transparent',
                color: unitSystem === sys ? '#fff' : '#1971c2',
              }}
            >
              {sys.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={GROUP_LABEL}>Last N samplings</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([5, 10, 15, 'all'] as const).map((n) => (
            <div
              key={n}
              {...pressable(() => setSampleLimit(n))}
              style={{
                ...TOGGLE_PILL,
                background: sampleLimit === n ? '#1971c2' : 'transparent',
                color: sampleLimit === n ? '#fff' : '#1971c2',
              }}
            >
              {n === 'all' ? 'All' : n}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ ...GROUP_LABEL, color: panelDisabled ? '#bbb' : '#888' }}>Show observations from</div>
        <select
          aria-label="Filter observations by monitoring panel"
          disabled={panelDisabled}
          title={panelReason}
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
      <div>
        <div style={GROUP_LABEL}>Find a marker</div>
        <input
          type="search"
          aria-label="Filter observations by name"
          placeholder="HGB, Гемоглобин, 718-7…"
          value={markerQuery.value}
          onChange={(e) => markerQuery.onChange(e.currentTarget.value)}
          style={FILTER_INPUT}
        />
      </div>
    </div>
  );
}
