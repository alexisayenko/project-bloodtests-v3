// Top-level sections (the nav menu), each its own URL hash, so the browser's
// back/forward always works. Panel detail nests under Monitoring Panels.
// Popups are transient overlays, not routes -- they never touch history.
export type Route =
  | { view: 'panels' }
  | { view: 'panel'; name: string }
  | { view: 'reference' }
  | { view: 'all' }
  | { view: 'profile' };

export const NAV_ITEMS: { view: 'reference' | 'panels' | 'all' | 'profile'; label: string }[] = [
  { view: 'reference', label: 'Reference Book' },
  { view: 'panels', label: 'Monitoring Panels' },
  { view: 'all', label: 'All Observations' },
  { view: 'profile', label: 'Profile' },
];

export function routeToHash(route: Route): string {
  if (route.view === 'panel') return `#panels/${encodeURIComponent(route.name)}`;
  if (route.view === 'reference') return '#reference';
  if (route.view === 'all') return '#all';
  if (route.view === 'profile') return '#profile';
  return '#panels';
}

export function hashToRoute(hash: string): Route {
  const value = decodeURIComponent(hash.replace(/^#/, ''));
  if (!value || value === 'panels') return { view: 'panels' };
  if (value === 'reference') return { view: 'reference' };
  if (value === 'all') return { view: 'all' };
  if (value === 'profile') return { view: 'profile' };
  if (value.startsWith('panels/')) return { view: 'panel', name: value.slice('panels/'.length) };
  return { view: 'panel', name: value }; // back-compat with pre-nav-menu links
}
