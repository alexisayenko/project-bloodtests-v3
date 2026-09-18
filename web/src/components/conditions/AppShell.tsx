import { type ReactNode, useLayoutEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { NavBar } from './NavBar';
import { SideNav } from './SideNav';
import { type Route } from './routing';
import { loadSidebarCollapsed, saveSidebarCollapsed } from './sidebarCollapsed';

export function AppShell({
  route,
  navigate,
  hasValidationErrors = false,
  children,
}: Readonly<{ route: Route; navigate: (r: Route) => void; hasValidationErrors?: boolean; children: ReactNode }>) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(loadSidebarCollapsed);

  // On the root element, since the footer outside the shell reads the same width variable.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute('data-sidebar-collapsed', collapsed);
    return () => {
      delete root.dataset.sidebarCollapsed;
    };
  }, [collapsed]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveSidebarCollapsed(next);
  };

  // Every slot keeps its place across the breakpoint, so rotating a phone never remounts the page.
  return (
    <div className="mc-shell">
      <div className="mc-shell-body">
        {isMobile ? null : (
          <SideNav
            route={route}
            navigate={navigate}
            hasValidationErrors={hasValidationErrors}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        )}
        <div className="mc-page">
          {isMobile ? <NavBar route={route} navigate={navigate} hasValidationErrors={hasValidationErrors} /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
