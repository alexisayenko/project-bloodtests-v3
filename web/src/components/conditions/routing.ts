// Top-level sections (the nav menu), each its own URL hash, so the browser's
// back/forward always works. Panel detail nests under Monitoring Panels.
// Popups are transient overlays, not routes -- they never touch history.
export type Route =
  | { view: 'panels' }
  | { view: 'panel'; name: string }
  | { view: 'reference'; key?: string }
  | { view: 'all' }
  | { view: 'reports' }
  | { view: 'report'; file: string }
  | { view: 'profile' };

export const NAV_ITEMS: { view: 'reference' | 'panels' | 'all' | 'reports' | 'profile'; label: string }[] = [
  { view: 'profile', label: 'Get Started' },
  { view: 'reports', label: 'Diagnostic Reports' },
  { view: 'all', label: 'All Observations' },
  { view: 'panels', label: 'Monitoring Panels' },
  { view: 'reference', label: 'Reference Book' },
];

export function routeToHash(route: Route): string {
  if (route.view === 'panel') return `#panels/${encodeURIComponent(route.name)}`;
  if (route.view === 'reference') return route.key ? `#reference/${encodeURIComponent(route.key)}` : '#reference';
  if (route.view === 'all') return '#all';
  if (route.view === 'report') return `#reports/${encodeURIComponent(route.file)}`;
  if (route.view === 'reports') return '#reports';
  if (route.view === 'profile') return '#profile';
  return '#panels';
}

export function hashToRoute(hash: string): Route {
  const value = decodeURIComponent(hash.replace(/^#/, ''));
  if (!value || value === 'panels') return { view: 'panels' };
  if (value === 'reference') return { view: 'reference' };
  if (value.startsWith('reference/')) return { view: 'reference', key: value.slice('reference/'.length) };
  if (value === 'all') return { view: 'all' };
  if (value === 'reports') return { view: 'reports' };
  if (value.startsWith('reports/')) return { view: 'report', file: value.slice('reports/'.length) };
  if (value === 'profile') return { view: 'profile' };
  if (value.startsWith('panels/')) return { view: 'panel', name: value.slice('panels/'.length) };
  return { view: 'panel', name: value }; // back-compat with pre-nav-menu links
}
