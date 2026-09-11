import type { CSSProperties } from 'react';
import { COLOR, RADIUS } from '../../styles/tokens';

export const TABLE = { borderCollapse: 'collapse', fontSize: 13 } as const;

export const TABLE_TH = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: `1.5px solid ${COLOR.accent}`,
  whiteSpace: 'nowrap',
} as const;

export const TABLE_TD = {
  padding: '8px 12px',
  borderBottom: `1px solid ${COLOR.borderSubtle}`,
  whiteSpace: 'nowrap',
} as const;

export const FIELD_INPUT = {
  border: `1px solid ${COLOR.border}`,
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
  background: COLOR.surface,
  color: COLOR.text,
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md';

const BUTTON_SIZE: Record<ButtonSize, CSSProperties> = {
  xs: { padding: '2px 14px', fontSize: 13 },
  sm: { padding: '4px 14px', fontSize: 13 },
  md: { padding: '8px 20px', fontSize: 14 },
};

function buttonColors(variant: ButtonVariant, disabled: boolean): CSSProperties {
  if (disabled && variant === 'primary') {
    return { border: `1.5px solid ${COLOR.border}`, background: COLOR.border, color: COLOR.primaryText, opacity: 0.5 };
  }
  if (disabled) return { border: `1.5px solid ${COLOR.border}`, background: 'transparent', color: COLOR.textMuted };
  if (variant === 'primary') return { border: `1.5px solid ${COLOR.primary}`, background: COLOR.primary, color: COLOR.primaryText };
  if (variant === 'danger') return { border: `1.5px solid ${COLOR.statusBad}`, background: 'transparent', color: COLOR.statusBadText };
  return { border: `1.5px solid ${COLOR.accent}`, background: 'transparent', color: COLOR.accent };
}

/** Shared by `Button` and `FileButton`, whose element is a label wrapping a hidden file input. */
export function buttonStyle(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', disabled = false): CSSProperties {
  return {
    display: 'inline-block',
    borderRadius: RADIUS.pill,
    fontFamily: 'inherit',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...BUTTON_SIZE[size],
    ...buttonColors(variant, disabled),
  };
}

/** Muted uppercase label above a group, as in `PageHeader`'s overline. */
export const OVERLINE = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: COLOR.textMuted,
} as const;

/** Header cell of a table that sits flush inside a `Card`: a muted band instead of the accent rule. */
export const CARD_TABLE_TH = {
  ...OVERLINE,
  textAlign: 'left',
  padding: '10px 16px',
  background: COLOR.surfaceMuted,
  borderBottom: `1px solid ${COLOR.borderSubtle}`,
  whiteSpace: 'nowrap',
} as const;

export const CARD_TABLE_TD = {
  padding: '10px 16px',
  borderBottom: `1px solid ${COLOR.borderSubtle}`,
  whiteSpace: 'nowrap',
} as const;

/** Holds a table: no padding, clipped to the card's radius so a tinted header or footer follows the corners. */
export const TABLE_CARD = { padding: 0, overflow: 'hidden' } as const;

export const DANGER_CARD = {
  border: `1px solid color-mix(in srgb, ${COLOR.statusBad} 30%, ${COLOR.surface})`,
  background: `color-mix(in srgb, ${COLOR.statusBadBg} 35%, ${COLOR.surface})`,
} as const;
