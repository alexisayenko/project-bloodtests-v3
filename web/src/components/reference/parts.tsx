import type { ReactNode } from 'react';
import { COLOR } from '../../styles/tokens';

export const EM_DASH = '—';

const EVIDENCE_BADGE: Record<string, { background: string; color: string }> = {
  guideline: { background: COLOR.accentSoft, color: COLOR.accent },
  consensus: { background: COLOR.statusOkBg, color: COLOR.statusOkText },
  heuristic: { background: COLOR.statusWarnBg, color: COLOR.statusWarnText },
};

export function Pill({ label, palette }: Readonly<{ label: string; palette?: { background: string; color: string } }>) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        ...(palette ?? { background: COLOR.surfaceMuted, color: COLOR.textSecondary }),
      }}
    >
      {label}
    </span>
  );
}

export function EvidenceBadge({ level }: Readonly<{ level: string }>) {
  return <Pill label={level} palette={EVIDENCE_BADGE[level]} />;
}

export function Mono({ children }: Readonly<{ children: ReactNode }>) {
  return <span style={{ fontFamily: 'monospace' }}>{children}</span>;
}

export function Scroller({ children }: Readonly<{ children: ReactNode }>) {
  return <div style={{ overflowX: 'auto', marginBottom: 20 }}>{children}</div>;
}

export function LoincLink({ loinc }: Readonly<{ loinc: string }>) {
  return (
    <a href={`https://loinc.org/${loinc}/`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', color: COLOR.accent }}>
      {loinc}
    </a>
  );
}
