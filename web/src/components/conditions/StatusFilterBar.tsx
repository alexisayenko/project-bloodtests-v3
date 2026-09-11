import { StatusToggle, type StatusTone } from '../primitives';
import { FILTER_TONES, toggleTone, type ToneCounts } from './statusFilter';

export function StatusFilterBar({
  active,
  counts,
  onChange,
}: Readonly<{ active: ReadonlySet<StatusTone>; counts: ToneCounts; onChange: (next: ReadonlySet<StatusTone>) => void }>) {
  return (
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
  );
}
