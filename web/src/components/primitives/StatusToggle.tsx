import { COLOR, RADIUS } from '../../styles/tokens';
import { StatusDot } from './Status';
import { TONE_LABEL, type StatusTone } from './tones';

/** Pill toggle for one status: dot, label and a count badge; `aria-pressed` carries the on/off state. */
export function StatusToggle({
  tone,
  count,
  pressed,
  onToggle,
}: Readonly<{ tone: StatusTone; count: number; pressed: boolean; onToggle: () => void }>) {
  const label = TONE_LABEL[tone];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`${label}, ${count} ${count === 1 ? 'marker' : 'markers'}`}
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 6px 0 12px',
        borderRadius: RADIUS.pill,
        border: `1px solid ${pressed ? COLOR.border : COLOR.borderSubtle}`,
        background: pressed ? COLOR.surface : 'transparent',
        color: pressed ? COLOR.text : COLOR.textMuted,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <StatusDot tone={tone} aria-hidden="true" style={{ opacity: pressed ? 1 : 0.35 }} />
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{
          minWidth: 20,
          padding: '1px 6px',
          boxSizing: 'border-box',
          borderRadius: RADIUS.pill,
          background: pressed ? COLOR.surfaceSunken : 'transparent',
          color: COLOR.textSecondary,
          fontSize: 11,
          fontWeight: 600,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
    </button>
  );
}
