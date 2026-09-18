import { useEffect, useRef, useState } from 'react';
import { hashToRoute, isRouteBlocked, routeToHash, type Route } from '../components/conditions/routing';

const REPORTS_ROUTE: Route = { view: 'reports' };

// In memory, not storage: a full reload is a fresh visit and should start at the top.
let savedPanelsScrollY: number | null = null;

export type HashRoute = { route: Route; navigate: (next: Route) => void };

/** The URL hash is the single source of truth for the route; every route object is fresh, so a consumer can key off identity. */
export function useHashRoute(hasValidationErrors: boolean): HashRoute {
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));

  // Redirected during render so the blocked view never paints; the URL is replaced, not pushed, so Back cannot loop.
  const [redirectCount, setRedirectCount] = useState(0);
  if (isRouteBlocked(route, hasValidationErrors)) {
    setRoute(REPORTS_ROUTE);
    setRedirectCount((n) => n + 1);
  }
  useEffect(() => {
    if (redirectCount > 0) window.history.replaceState(null, '', routeToHash(REPORTS_ROUTE));
  }, [redirectCount]);

  useEffect(() => {
    const onPopState = () => setRoute(hashToRoute(window.location.hash));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: Route) => {
    if (route.view === 'panels' && next.view === 'panel') savedPanelsScrollY = window.scrollY;
    window.history.pushState(null, '', routeToHash(next));
    setRoute(next);
  };

  // Keyed off the route itself so chevron and browser Back restore alike; deferred a frame so the grid has laid out.
  const prevRouteRef = useRef(route);
  useEffect(() => {
    const prev = prevRouteRef.current;
    prevRouteRef.current = route;
    if (prev.view === 'panel' && route.view === 'panels' && savedPanelsScrollY != null) {
      const y = savedPanelsScrollY;
      savedPanelsScrollY = null;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, [route]);

  return { route, navigate };
}
