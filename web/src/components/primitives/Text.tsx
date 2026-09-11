import type { HTMLAttributes } from 'react';
import { COLOR } from '../../styles/tokens';

export function SectionTitle({ style, ...rest }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, ...style }} {...rest} />;
}

export function EmptyState({ style, ...rest }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div style={{ color: COLOR.textMuted, fontSize: 14, ...style }} {...rest} />;
}
