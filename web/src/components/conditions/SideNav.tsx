import { Rocket, FileText, List, LayoutGrid, CalendarCheck, BookOpen, CircleUser, ChevronsLeft, Droplets, ChevronsRight, type LucideIcon } from 'lucide-react';
import { PathwaysIcon, PillIcon, type IconComponent } from './customIcons';
import { NAV_ITEMS, isNavItemActive, isNavItemBlocked, type NavView, type Route } from './routing';
import { pressable } from '../primitives/styles';
import { COLOR } from '../../styles/tokens';

const ICONS: Record<NavView, LucideIcon | IconComponent> = {
  profile:     Rocket,
  reports:     FileText,
  all:         List,
  panels:      LayoutGrid,
  pathways:    PathwaysIcon,
  lipids:      Droplets,
  plan:        CalendarCheck,
  medications: PillIcon,
  reference:   BookOpen,
  account:     CircleUser,
};

const BLOCKED_TITLE = 'Errors in diagnostic reports block access';

export function SideNav({
  route,
  navigate,
  hasValidationErrors = false,
  collapsed = false,
  onToggleCollapsed,
}: Readonly<{
  route: Route;
  navigate: (r: Route) => void;
  hasValidationErrors?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}>) {
  const topItems = NAV_ITEMS.filter((i) => i.view !== 'account');
  const accountItem = NAV_ITEMS.find((i) => i.view === 'account');

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = isNavItemActive(route, item.view);
    const isBlocked = isNavItemBlocked(item.view, hasValidationErrors);
    const Icon = ICONS[item.view];
    let title: string | undefined;
    if (collapsed) title = isBlocked ? `${item.label}: ${BLOCKED_TITLE.toLowerCase()}` : item.label;
    else if (isBlocked) title = BLOCKED_TITLE;
    return (
      <div
        key={item.view}
        {...pressable(() => {
          if (!isBlocked) navigate({ view: item.view });
        })}
        className="mc-side-item"
        aria-current={active ? 'page' : undefined}
        aria-disabled={isBlocked || undefined}
        aria-label={collapsed ? item.label : undefined}
        title={title}
      >
        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        <span>{item.label}</span>
      </div>
    );
  };

  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;

  return (
    <aside className="mc-sidebar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {onToggleCollapsed && (
        <button
          type="button"
          className="mc-side-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ToggleIcon size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
      <div>
        <div className="mc-side-top">
          <div
            {...pressable(() => navigate({ view: 'panels' }))}
            className="mc-side-logo"
            aria-label="Paneloom, go to Monitoring Panels"
            title={collapsed ? 'Paneloom, go to Monitoring Panels' : undefined}
          >
            <img src="/brand/paneloom-mark.svg" alt="" width={26} height={26} />
            <span style={{ fontSize: 19, fontWeight: 700, color: COLOR.text, letterSpacing: -0.2 }}>Paneloom</span>
          </div>
        </div>
        <nav aria-label="Sections" className="mc-side-list">
          {topItems.map(renderItem)}
        </nav>
      </div>

      <div className="mc-side-tagline" style={{ margin: 'auto 0' }}>
        <div>Your results.</div>
        <div>Your history.</div>
        <div>In your browser.</div>
      </div>

      <div>
        {accountItem && (
          <nav aria-label="Account" className="mc-side-list" style={{ marginBottom: 12 }}>
            {renderItem(accountItem)}
          </nav>
        )}
      </div>
    </aside>
  );
}
