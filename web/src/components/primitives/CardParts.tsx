import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { COLOR, FONT, SPACE } from '../../styles/tokens';
import { Card } from './Card';
import { DANGER_CARD, OVERLINE } from './styles';

export function Overline({ style, ...rest }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div style={{ ...OVERLINE, ...style }} {...rest} />;
}

export function CardTitle({ style, ...rest }: Readonly<HTMLAttributes<HTMLHeadingElement>>) {
  return <h2 style={{ margin: 0, fontSize: FONT.cardTitle, fontWeight: 600, lineHeight: 1.3, color: COLOR.navy, ...style }} {...rest} />;
}

export function CardDescription({ style, ...rest }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div style={{ marginTop: 4, fontSize: FONT.small, lineHeight: 1.5, color: COLOR.textMuted, ...style }} {...rest} />;
}

/** A round tinted badge holding a line icon, the grid cards' `.mc-panel-icon` at a smaller size. */
export function IconBadge({
  icon: Icon,
  color = COLOR.accent,
  background = COLOR.accentSoft,
  size = 40,
}: Readonly<{ icon: LucideIcon; color?: string; background?: string; size?: number }>) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        background,
        color,
      }}
    >
      <Icon size={Math.round(size / 2)} strokeWidth={2} color="currentColor" />
    </span>
  );
}

/** A card whose action cannot be undone: a rose hairline and wash instead of the neutral ones. */
export function DangerCard({ style, ...rest }: Readonly<HTMLAttributes<HTMLDivElement> & { padding?: CSSProperties['padding'] }>) {
  return <Card style={{ ...DANGER_CARD, ...style }} {...rest} />;
}

/** Title row of a card: optional icon badge, title and description, and an aside pushed to the right. */
export function CardHeader({
  icon,
  title,
  description,
  aside,
  style,
}: Readonly<{ icon?: ReactNode; title: ReactNode; description?: ReactNode; aside?: ReactNode; style?: CSSProperties }>) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE[3], ...style }}>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {aside}
    </div>
  );
}
