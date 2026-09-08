import { NAV_ITEMS, type Route } from './routing';
import { pressable, tabStyle } from './ui';

export function NavBar({ route, navigate, hasValidationErrors = false }: Readonly<{ route: Route; navigate: (r: Route) => void; hasValidationErrors?: boolean }>) {
  return (
    <div className="mc-nav">
      {NAV_ITEMS.map((item) => {
        const active =
          route.view === item.view ||
          (item.view === 'panels' && route.view === 'panel') ||
          (item.view === 'reports' && route.view === 'report');
        const isBlocked = hasValidationErrors && (item.view === 'panels' || item.view === 'all');
        const tab = tabStyle(active);
        return (
          <div
            key={item.view}
            {...pressable(() => {
              if (!isBlocked) navigate({ view: item.view });
            })}
            title={isBlocked ? 'Errors in diagnostic reports block access' : ''}
            style={{
              padding: '12px 2px',
              marginBottom: -1.5,
              fontSize: 15,
              ...tab,
              color: isBlocked && !active ? '#ccc' : tab.color,
              cursor: isBlocked ? 'not-allowed' : 'pointer',
              opacity: isBlocked ? 0.5 : 1,
            }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
}
