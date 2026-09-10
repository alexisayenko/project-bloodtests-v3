import { BookOpen, CalendarCheck, CircleUser, FileText, LayoutGrid, List, Pill, Rocket, type LucideIcon } from 'lucide-react';
import { NAV_ITEMS, isNavItemActive, isNavItemBlocked, type NavView, type Route } from './routing';
import { pressable } from './ui';

const ICONS: Record<NavView, LucideIcon> = {
  profile: Rocket,
  reports: FileText,
  all: List,
  panels: LayoutGrid,
  plan: CalendarCheck,
  medications: Pill,
  reference: BookOpen,
  account: CircleUser,
};

export function SideNav({ route, navigate, hasValidationErrors = false }: Readonly<{ route: Route; navigate: (r: Route) => void; hasValidationErrors?: boolean }>) {
  return (
    <aside className="mc-sidebar">
      <nav aria-label="Sections" className="mc-side-list">
        {NAV_ITEMS.map((item) => {
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
        })}
      </nav>
    </aside>
  );
}
