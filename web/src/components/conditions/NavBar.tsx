import { NAV_ITEMS, type Route } from './routing';
import { pressable } from './ui';

export function NavBar({ route, navigate }: Readonly<{ route: Route; navigate: (r: Route) => void }>) {
  return (
    <div style={{ display: 'flex', gap: 32, marginBottom: 32, borderBottom: '1.5px solid #eee' }}>
      {NAV_ITEMS.map((item) => {
        const active = route.view === item.view || (item.view === 'panels' && route.view === 'panel');
        return (
          <div
            key={item.view}
            {...pressable(() => navigate({ view: item.view }))}
            style={{
              padding: '12px 2px',
              marginBottom: -1.5,
              borderBottom: active ? '2px solid #1971c2' : '2px solid transparent',
              fontSize: 15,
              fontWeight: active ? 600 : 400,
              color: active ? '#1971c2' : '#555',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
}
