import { Rocket, FileText, List, LayoutGrid, CalendarCheck, BookOpen, CircleUser, type LucideIcon } from 'lucide-react';
import { PillIcon, type IconComponent } from './customIcons';
import { NAV_ITEMS, isNavItemActive, isNavItemBlocked, type NavView, type Route } from './routing';
import { pressable } from './ui';

const ICONS: Record<NavView, LucideIcon | IconComponent> = {
  profile:     Rocket,
  reports:     FileText,
  all:         List,
  panels:      LayoutGrid,
  plan:        CalendarCheck,
  medications: PillIcon,
  reference:   BookOpen,
  account:     CircleUser,
};

export function SideNav({
  route,
  navigate,
  hasValidationErrors = false,
}: Readonly<{ route: Route; navigate: (r: Route) => void; hasValidationErrors?: boolean }>) {
  const topItems = NAV_ITEMS.filter((i) => i.view !== 'account');
  const accountItem = NAV_ITEMS.find((i) => i.view === 'account');

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = isNavItemActive(route, item.view);
    const isBlocked = isNavItemBlocked(item.view, hasValidationErrors);
    const Icon = ICONS[item.view];
    return (
      <div
        key={item.view}
        {...pressable(() => {
          if (!isBlocked) navigate({ view: item.view });
        })}
        className="mc-side-item"
        aria-current={active ? 'page' : undefined}
        aria-disabled={isBlocked || undefined}
        title={isBlocked ? 'Errors in diagnostic reports block access' : undefined}
      >
        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        <span>{item.label}</span>
      </div>
    );
  };

  return (
    <aside className="mc-sidebar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <nav aria-label="Sections" className="mc-side-list">
        {topItems.map(renderItem)}
      </nav>

      <div>
        {accountItem && (
          <nav aria-label="Account" className="mc-side-list" style={{ marginBottom: 12 }}>
            {renderItem(accountItem)}
          </nav>
        )}
        <div style={{ padding: '4px 12px 12px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <div>Your results.</div>
          <div>Your history.</div>
          <div>In your browser.</div>
        </div>
      </div>
    </aside>
  );
}
