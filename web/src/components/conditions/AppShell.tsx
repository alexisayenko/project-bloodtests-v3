import { type ReactNode, useLayoutEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { NavBar } from './NavBar';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
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

  // The footer renders outside the shell, so the width variable is switched on
  // the root element, where the sidebar, the page and the footer all read it.
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

  // Every slot keeps its place whichever shell is showing, so crossing the
  // breakpoint (a phone rotated to landscape) never remounts the page below.
  return (
    <div className="mc-shell">
      {isMobile ? null : <TopBar navigate={navigate} />}
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
