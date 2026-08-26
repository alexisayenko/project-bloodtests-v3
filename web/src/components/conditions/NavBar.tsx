import { NAV_ITEMS, type Route } from './routing';
import { pressable } from './ui';

export function NavBar({ route, navigate }: Readonly<{ route: Route; navigate: (r: Route) => void }>) {
  return (
    <div className="mc-nav">
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
              // Faux-bold via text-shadow, not fontWeight: a real weight change measures
              // wider and reflows neighboring tabs by a px when switching (the jitter this
              // was written to fix) -- this keeps the glyph metrics, hence the row width,
              // identical in both states.
              textShadow: active ? '0.3px 0 currentColor, -0.3px 0 currentColor' : 'none',
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
