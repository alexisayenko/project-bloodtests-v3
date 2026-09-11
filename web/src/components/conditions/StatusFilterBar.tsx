import { COLOR } from '../../styles/tokens';
import { StatusToggle, type StatusTone } from '../primitives';
import { ABNORMAL_TONES, ALL_TONES, FILTER_TONES, sameTones, toggleTone, type ToneCounts } from './statusFilter';

const PRESETS = [
  { label: 'All', tones: ALL_TONES },
  { label: 'Abnormal only', tones: ABNORMAL_TONES },
] as const;

export function StatusFilterBar({
  active,
  counts,
  onChange,
}: Readonly<{ active: ReadonlySet<StatusTone>; counts: ToneCounts; onChange: (next: ReadonlySet<StatusTone>) => void }>) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px' }}>
      <div role="group" aria-label="Filter markers by status" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FILTER_TONES.map((tone) => (
          <StatusToggle
            key={tone}
            tone={tone}
            count={counts[tone]}
            pressed={active.has(tone)}
            onToggle={() => onChange(toggleTone(active, tone))}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {PRESETS.map((preset) => {
          const current = sameTones(active, preset.tones);
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.tones)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '4px 6px',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: current ? 600 : 500,
                color: current ? COLOR.text : COLOR.accent,
                cursor: 'pointer',
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
