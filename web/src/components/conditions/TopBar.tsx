import { Lock } from 'lucide-react';
import { type Route } from './routing';
import { pressable } from './ui';
import { COLOR } from '../../styles/tokens';

export function TopBar({ navigate }: Readonly<{ navigate: (r: Route) => void }>) {
  return (
    <header className="mc-topbar">
      <div
        {...pressable(() => navigate({ view: 'panels' }))}
        aria-label="Paneloom, go to Monitoring Panels"
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <img src="/brand/paneloom-mark.svg" alt="" width={26} height={26} />
        <span style={{ fontSize: 19, fontWeight: 700, color: COLOR.text, letterSpacing: -0.2 }}>Paneloom</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLOR.textSecondary }}>
        <Lock size={14} strokeWidth={2} aria-hidden="true" />
        Your data stays in this browser
      </div>
    </header>
  );
}
