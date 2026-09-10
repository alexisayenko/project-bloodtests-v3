import { type ReactNode } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { NavBar } from './NavBar';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { type Route } from './routing';

export function AppShell({
  route,
  navigate,
  hasValidationErrors = false,
  children,
}: Readonly<{ route: Route; navigate: (r: Route) => void; hasValidationErrors?: boolean; children: ReactNode }>) {
  const isMobile = useIsMobile();
  // Every slot keeps its place whichever shell is showing, so crossing the
  // breakpoint (a phone rotated to landscape) never remounts the page below.
  return (
    <div className="mc-shell">
      {isMobile ? null : <TopBar navigate={navigate} />}
      <div className="mc-shell-body">
        {isMobile ? null : <SideNav route={route} navigate={navigate} hasValidationErrors={hasValidationErrors} />}
        <div className="mc-page">
          {isMobile ? <NavBar route={route} navigate={navigate} hasValidationErrors={hasValidationErrors} /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
