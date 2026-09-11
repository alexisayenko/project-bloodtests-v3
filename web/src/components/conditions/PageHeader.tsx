import type { LucideIcon } from 'lucide-react';
import { COLOR } from '../../styles/tokens';

export type HeaderPillar = {
  icon: LucideIcon;
  line1: string;
  line2: string;
};

export type PageHeaderProps = {
  overline: string;
  titlePrimary: string;
  titleAccent: string;
  description: string[];
  pillars?: HeaderPillar[];
};

export function PageHeader({
  overline,
  titlePrimary,
  titleAccent,
  description,
  pillars = [],
}: Readonly<PageHeaderProps>) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 32,
        marginBottom: 32,
        padding: '8px 4px 28px',
        borderBottom: `1px solid ${COLOR.borderSubtle}`,
        flexWrap: 'wrap',
        background:
          `radial-gradient(ellipse 60% 90% at 88% 20%, ${COLOR.surfaceMint} 0%, transparent 70%)`,
      }}
    >
      <div style={{ flex: '1 1 460px', minWidth: 300 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: COLOR.accent,
            marginBottom: 8,
          }}
        >
          {overline}
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.6, marginBottom: 12, lineHeight: 1.15 }}>
          <span style={{ color: COLOR.text }}>{titlePrimary} </span>
          <span style={{ color: COLOR.accent }}>{titleAccent}</span>
        </h1>
        <div style={{ fontSize: 14, color: COLOR.textSecondary, lineHeight: 1.55 }}>
          {description.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>

      {pillars.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.line1} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {idx > 0 && <div style={{ width: 1, height: 44, background: COLOR.borderSubtle }} />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Icon size={20} color={COLOR.accent} strokeWidth={2.2} aria-hidden="true" />
                  <div style={{ fontSize: 12, color: COLOR.textSecondary, lineHeight: 1.35 }}>
                    <div>{pillar.line1}</div>
                    <div>{pillar.line2}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
