import { useEffect, useRef } from 'react';
import { NAV_ITEMS, type Route } from './routing';
import { pressable, tabStyle } from './ui';
import { useHideOnScroll } from './useHideOnScroll';
import { COLOR } from '../../styles/tokens';

export function NavBar({ route, navigate, hasValidationErrors = false }: Readonly<{ route: Route; navigate: (r: Route) => void; hasValidationErrors?: boolean }>) {
  // Mobile pins the nav over the content and slides it away while you read
  // downwards; the CSS that does so is behind the mobile breakpoint, so on
  // desktop this state is measured and then ignored.
  const hidden = useHideOnScroll();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const publish = () => document.documentElement.style.setProperty('--mc-nav-h', `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Fixed overlays elsewhere (a table's pulled-open header row) read
    // --mc-nav-offset to park below whatever the nav currently occupies.
    document.documentElement.dataset.mcNavHidden = String(hidden);
  }, [hidden]);

  return (
    <div ref={ref} className={hidden ? 'mc-nav mc-nav-hidden' : 'mc-nav'}>
      <div
        {...pressable(() => navigate({ view: 'panels' }))}
        aria-label="Paneloom, go to Monitoring Panels"
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12, cursor: 'pointer' }}
      >
        <img src="/brand/paneloom-mark.svg" alt="" width={26} height={26} />
        <span style={{ fontSize: 19, fontWeight: 700, color: COLOR.navy, letterSpacing: -0.2 }}>Paneloom</span>
      </div>
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
              color: isBlocked && !active ? COLOR.textDisabled : tab.color,
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
