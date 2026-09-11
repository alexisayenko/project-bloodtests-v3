import { COLOR, RADIUS } from '../../styles/tokens';

/** A labelled on/off switch rendered as one button; `aria-pressed` carries the state. */
export function SwitchToggle({
  label,
  pressed,
  onChange,
}: Readonly<{ label: string; pressed: boolean; onChange: (next: boolean) => void }>) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 40,
        padding: '0 14px',
        borderRadius: RADIUS.control,
        border: `1px solid ${pressed ? COLOR.accentLine : COLOR.borderSubtle}`,
        background: pressed ? COLOR.accentSoft : COLOR.surface,
        color: pressed ? COLOR.accent : COLOR.textSecondary,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 26,
          height: 14,
          borderRadius: RADIUS.pill,
          background: pressed ? COLOR.accent : COLOR.border,
          flexShrink: 0,
          transition: 'background 0.15s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: pressed ? 14 : 2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: COLOR.surface,
            transition: 'left 0.15s ease',
          }}
        />
      </span>
      {label}
    </button>
  );
}
