import type { CSSProperties, HTMLAttributes } from 'react';
import { COLOR, RADIUS, SHADOW } from '../../styles/tokens';

export function Card({
  padding = '16px 20px',
  style,
  ...rest
}: Readonly<HTMLAttributes<HTMLDivElement> & { padding?: CSSProperties['padding'] }>) {
  return (
    <div
      style={{
        background: COLOR.surfaceCard,
        border: `1px solid ${COLOR.borderSubtle}`,
        borderRadius: RADIUS.card,
        boxShadow: SHADOW.card,
        padding,
        ...style,
      }}
      {...rest}
    />
  );
}
