import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { IconComponent } from '../conditions/customIcons';
import { pressable } from '../conditions/ui';
import { TONE_DOT, type StatusTone } from './tones';

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
