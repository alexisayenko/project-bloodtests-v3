import { pressable, type AnalysisSettings } from './ui';

export type ControlsProps = AnalysisSettings & {
  setUnitSystem: (v: 'si' | 'us') => void;
  setSampleLimit: (v: number | 'all') => void;
  setDateOrder: (v: 'asc' | 'desc') => void;
};

const PILL = {
  padding: '4px 12px',
  borderRadius: 9999,
  border: '1.5px solid #1971c2',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

// Shared table controls (unit system, samplings shown, column order) — one
// setting across the panel Analysis tables and All Observations alike.
export function ControlsBar({ unitSystem, setUnitSystem, sampleLimit, setSampleLimit, dateOrder, setDateOrder }: Readonly<ControlsProps>) {
  return (
    <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Unit system</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['si', 'us'] as const).map((sys) => (
            <div
              key={sys}
              {...pressable(() => setUnitSystem(sys))}
              style={{
                ...PILL,
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
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Last N samplings</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([5, 10, 15, 'all'] as const).map((n) => (
            <div
              key={n}
              {...pressable(() => setSampleLimit(n))}
              style={{
                ...PILL,
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
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Column order</div>
        <div
          {...pressable(() => setDateOrder(dateOrder === 'desc' ? 'asc' : 'desc'))}
          style={{ ...PILL, display: 'inline-block', color: '#1971c2' }}
        >
          {dateOrder === 'desc' ? 'Newest → Oldest' : 'Oldest → Newest'}
        </div>
      </div>
    </div>
  );
}
