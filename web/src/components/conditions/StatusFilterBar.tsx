import { StatusToggle, VISUALLY_HIDDEN, type StatusTone } from '../primitives';
import { FILTER_TONES, toggleTone, type ToneCounts } from './statusFilter';

export function StatusFilterBar({
  active,
  counts,
  onChange,
}: Readonly<{ active: ReadonlySet<StatusTone>; counts: ToneCounts; onChange: (next: ReadonlySet<StatusTone>) => void }>) {
  return (
    <fieldset style={{ display: 'flex', flexWrap: 'wrap', gap: 8, border: 0, margin: 0, padding: 0 }}>
      <legend style={VISUALLY_HIDDEN}>Filter markers by status</legend>
      {FILTER_TONES.map((tone) => (
        <StatusToggle
          key={tone}
          tone={tone}
          count={counts[tone]}
          pressed={active.has(tone)}
          onToggle={() => onChange(toggleTone(active, tone))}
        />
      ))}
    </fieldset>
  );
}
