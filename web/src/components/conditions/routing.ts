// Top-level sections (the nav menu), each its own URL hash, so the browser's
// back/forward always works. Panel detail nests under Monitoring Panels.
// Popups are transient overlays, not routes -- they never touch history.
export const OBSERVATIONS_TAB_IDS = ['analysis', 'trends', 'in-range'] as const;
export type ObservationsTab = (typeof OBSERVATIONS_TAB_IDS)[number];
export const DEFAULT_OBSERVATIONS_TAB: ObservationsTab = 'analysis';

export type Route =
  | { view: 'panels' }
  | { view: 'panel'; name: string }
  | { view: 'pathways' }
  | { view: 'reference'; key?: string }
  | { view: 'all'; tab?: ObservationsTab }
  | { view: 'reports' }
  | { view: 'report'; file: string }
  | { view: 'profile' }
  | { view: 'medications' }
  | { view: 'plan' }
  | { view: 'account' };

export const NAV_ITEMS: { view: 'reference' | 'panels' | 'pathways' | 'all' | 'reports' | 'profile' | 'medications' | 'plan' | 'account'; label: string }[] = [
  { view: 'profile',      label: 'Get Started' },
  { view: 'reports',      label: 'Diagnostic Reports' },
  { view: 'all',          label: 'All Observations' },
  { view: 'panels',       label: 'Monitoring Panels' },
  { view: 'pathways',     label: 'Hormonal Pathways' },
  { view: 'plan',         label: 'Scheduled Visits' },
  { view: 'medications',  label: 'Medications' },
  { view: 'reference',    label: 'Reference Book' },
  { view: 'account',      label: 'Account' },
];

export type NavView = (typeof NAV_ITEMS)[number]['view'];

export function isNavItemActive(route: Route, view: NavView): boolean {
  return route.view === view || (view === 'panels' && route.view === 'panel') || (view === 'reports' && route.view === 'report');
}

// Panel Detail nests under Monitoring Panels, so it is blocked with it.
export function isRouteBlocked(route: Route, hasValidationErrors: boolean): boolean {
  return hasValidationErrors && (route.view === 'panels' || route.view === 'panel' || route.view === 'pathways' || route.view === 'all');
}

export function isNavItemBlocked(view: NavView, hasValidationErrors: boolean): boolean {
  return isRouteBlocked({ view }, hasValidationErrors);
}

// The default tab and an unknown segment both collapse to bare #all, so one
// view has one canonical hash.
export function allObservationsRoute(tab: string): Route {
  const known = OBSERVATIONS_TAB_IDS.find((id) => id === tab);
  return known && known !== DEFAULT_OBSERVATIONS_TAB ? { view: 'all', tab: known } : { view: 'all' };
}

export function routeToHash(route: Route): string {
  if (route.view === 'panel') return `#panels/${encodeURIComponent(route.name)}`;
  if (route.view === 'reference') return route.key ? `#reference/${encodeURIComponent(route.key)}` : '#reference';
  if (route.view === 'all') return route.tab && route.tab !== DEFAULT_OBSERVATIONS_TAB ? `#all/${route.tab}` : '#all';
  if (route.view === 'report') return `#reports/${encodeURIComponent(route.file)}`;
  if (route.view === 'reports') return '#reports';
  if (route.view === 'pathways') return '#pathways';
  if (route.view === 'profile') return '#profile';
  if (route.view === 'medications') return '#medications';
  if (route.view === 'plan') return '#plan';
  if (route.view === 'account') return '#account';
  return '#panels';
}

export function hashToRoute(hash: string): Route {
  const value = decodeURIComponent(hash.replace(/^#/, ''));
  if (!value || value === 'panels') return { view: 'panels' };
  if (value === 'reference') return { view: 'reference' };
  if (value.startsWith('reference/')) return { view: 'reference', key: value.slice('reference/'.length) };
  if (value === 'all') return { view: 'all' };
  if (value.startsWith('all/')) return allObservationsRoute(value.slice('all/'.length));
  if (value === 'reports') return { view: 'reports' };
  if (value.startsWith('reports/')) return { view: 'report', file: value.slice('reports/'.length) };
  if (value === 'pathways') return { view: 'pathways' };
  if (value === 'profile') return { view: 'profile' };
  if (value === 'medications') return { view: 'medications' };
  if (value === 'plan') return { view: 'plan' };
  if (value === 'account') return { view: 'account' };
  if (value.startsWith('panels/')) return { view: 'panel', name: value.slice('panels/'.length) };
  return { view: 'panel', name: value }; // back-compat with pre-nav-menu links
}
