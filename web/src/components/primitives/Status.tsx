import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { IconComponent } from '../conditions/customIcons';
import { pressable } from '../conditions/ui';
import { COLOR } from '../../styles/tokens';
import { TONE_DOT, TONE_LABEL, type StatusTone } from './tones';

export function StatusDot({
  tone = 'none',
  color,
  size = 8,
  style,
  ...rest
}: Readonly<HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone; color?: string; size?: number }>) {
  return (
    <span
      style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color ?? TONE_DOT[tone], flexShrink: 0, ...style }}
      {...rest}
    />
  );
}

/** White pill with a status dot; pressable when given `onClick`. Its look and hover live in `.mc-chip`. */
export function StatusChip({
  label,
  tone,
  color,
  icon: Icon,
  title,
  onClick,
}: Readonly<{
  label: ReactNode;
  tone?: StatusTone;
  color?: string;
  icon?: LucideIcon | IconComponent;
  title?: string;
  onClick?: (e: { currentTarget: HTMLElement }) => void;
}>) {
  const content = (
    <>
      {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
      <StatusDot tone={tone} color={color} aria-hidden="true" />
      <span>{label}</span>
    </>
  );
  if (!onClick) {
    return (
      <span className="mc-chip" title={title}>
        {content}
      </span>
    );
  }
  return (
    <button type="button" className="mc-chip" title={title} {...pressable(onClick)}>
      {content}
    </button>
  );
}

const LEGEND_TONES: readonly StatusTone[] = ['ok', 'warn', 'bad', 'none'];

export function StatusLegend({ style }: Readonly<{ style?: CSSProperties }>) {
  return (
    <ul
      aria-label="Status legend"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', listStyle: 'none', fontSize: 12, color: COLOR.textSecondary, ...style }}
    >
      {LEGEND_TONES.map((tone) => (
        <li key={tone} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <StatusDot tone={tone} aria-hidden="true" />
          {TONE_LABEL[tone]}
        </li>
      ))}
    </ul>
  );
}
