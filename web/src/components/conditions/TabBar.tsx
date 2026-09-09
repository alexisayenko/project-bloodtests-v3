import { pressable, tabStyle } from './ui';
import { COLOR } from '../../styles/tokens';

// An in-page tab strip, sitting under a view's <h1>. The top nav is NOT one of
// these: it has its own spacing (.mc-nav), font size and blocked state, and
// only shares the active-tab look, via `tabStyle`.
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: Readonly<{ tabs: readonly { id: T; label: string }[]; active: T; onChange: (id: T) => void }>) {
  return (
    <div style={{ display: 'flex', gap: 8, borderBottom: `1.5px solid ${COLOR.borderSubtle}`, marginBottom: 24 }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          {...pressable(() => onChange(tab.id))}
          style={{ padding: '10px 4px', marginBottom: -2, ...tabStyle(active === tab.id), cursor: 'pointer' }}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
}
