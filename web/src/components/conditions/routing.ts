// Each section is its own URL hash; popups are overlays, not routes, and never touch history.
export const PANEL_TAB_IDS = ['analysis', 'trends'] as const;
export type PanelTab = (typeof PANEL_TAB_IDS)[number];
export const DEFAULT_PANEL_TAB: PanelTab = 'analysis';

/** The cross-panel pseudo-panel name routed through the same `{view:'panel'}` shape as a real panel. */
export const ALL_OBSERVATIONS_PANEL = 'All Observations';

export type Route =
  | { view: 'panels' }
  | { view: 'panel'; name: string; tab?: PanelTab }
  | { view: 'pathways' }
  | { view: 'lipids' }
  | { view: 'reference'; key?: string }
  | { view: 'reports' }
  | { view: 'report'; file: string }
  | { view: 'profile' }
  | { view: 'medications' }
  | { view: 'plan' }
  | { view: 'account' };

export const NAV_ITEMS: { view: 'reference' | 'panels' | 'pathways' | 'lipids' | 'all' | 'reports' | 'profile' | 'medications' | 'plan' | 'account'; label: string }[] = [
  { view: 'profile',      label: 'Get Started' },
  { view: 'reports',      label: 'Diagnostic Reports' },
  { view: 'all',          label: 'All Observations' },
  { view: 'panels',       label: 'Monitoring Panels' },
  { view: 'pathways',     label: 'Hormonal Pathways' },
  { view: 'lipids',       label: 'Lipid Transport' },
  { view: 'plan',         label: 'Scheduled Visits' },
  { view: 'medications',  label: 'Medications' },
  { view: 'reference',    label: 'Reference Book' },
  { view: 'account',      label: 'Account' },
];

export type NavView = (typeof NAV_ITEMS)[number]['view'];

/** Every NAV_ITEMS entry is a simple route today, except 'all', which is the All Observations pseudo-panel. */
export function navItemRoute(view: NavView): Route {
  if (view === 'all') return { view: 'panel', name: ALL_OBSERVATIONS_PANEL };
  return { view } as Route;
}

export function isNavItemActive(route: Route, view: NavView): boolean {
  if (view === 'all') return route.view === 'panel' && route.name === ALL_OBSERVATIONS_PANEL;
  if (view === 'panels') return route.view === 'panel' && route.name !== ALL_OBSERVATIONS_PANEL;
  return route.view === view || (view === 'reports' && route.view === 'report');
}

// Panel Detail nests under Monitoring Panels, so it is blocked with it.
export function isRouteBlocked(route: Route, hasValidationErrors: boolean): boolean {
  return hasValidationErrors && (route.view === 'panels' || route.view === 'panel' || route.view === 'pathways' || route.view === 'lipids');
}

export function isNavItemBlocked(view: NavView, hasValidationErrors: boolean): boolean {
  return isRouteBlocked(navItemRoute(view), hasValidationErrors);
}

// The default tab and an unknown segment both collapse to the bare panel hash, so one panel has one canonical hash.
export function panelRoute(name: string, tab?: string): Route {
  const known = PANEL_TAB_IDS.find((id) => id === tab);
  return known && known !== DEFAULT_PANEL_TAB ? { view: 'panel', name, tab: known } : { view: 'panel', name };
}

// The views with no associated data -- their hash is just the view name.
function simpleRouteHash(view: Route['view']): string | undefined {
  if (view === 'reports') return '#reports';
  if (view === 'pathways') return '#pathways';
  if (view === 'lipids') return '#lipids';
  if (view === 'profile') return '#profile';
  if (view === 'medications') return '#medications';
  if (view === 'plan') return '#plan';
  if (view === 'account') return '#account';
  return undefined;
}

export function routeToHash(route: Route): string {
  if (route.view === 'panel') {
    const base = `#panels/${encodeURIComponent(route.name)}`;
    return route.tab && route.tab !== DEFAULT_PANEL_TAB ? `${base}/${route.tab}` : base;
  }
  if (route.view === 'reference') return route.key ? `#reference/${encodeURIComponent(route.key)}` : '#reference';
  if (route.view === 'report') return `#reports/${encodeURIComponent(route.file)}`;
  return simpleRouteHash(route.view) ?? '#panels';
}

// Legacy #all(/tab) links collapse onto the All Observations pseudo-panel; the old 'in-range' tab folds into 'trends'.
function legacyAllRoute(tab: string | undefined): Route {
  if (tab === 'trends' || tab === 'in-range') return { view: 'panel', name: ALL_OBSERVATIONS_PANEL, tab: 'trends' };
  return { view: 'panel', name: ALL_OBSERVATIONS_PANEL };
}

function parseReferenceHash(value: string): Route | undefined {
  if (value === 'reference') return { view: 'reference' };
  if (value.startsWith('reference/')) return { view: 'reference', key: value.slice('reference/'.length) };
  return undefined;
}

function parseReportsHash(value: string): Route | undefined {
  if (value === 'reports') return { view: 'reports' };
  if (value.startsWith('reports/')) return { view: 'report', file: value.slice('reports/'.length) };
  return undefined;
}

// The views with no associated data and no prefixed variant -- an exact hash match only.
const BARE_VIEW_HASHES: Partial<Record<string, Route['view']>> = {
  pathways: 'pathways',
  lipids: 'lipids',
  profile: 'profile',
  medications: 'medications',
  plan: 'plan',
  account: 'account',
};

function parseBareViewHash(value: string): Route | undefined {
  const view = BARE_VIEW_HASHES[value];
  return view ? { view } as Route : undefined;
}

function parsePanelsHash(rest: string): Route {
  const slash = rest.indexOf('/');
  if (slash === -1) return { view: 'panel', name: rest };
  const name = rest.slice(0, slash);
  const rawTab = rest.slice(slash + 1);
  // Legacy per-panel "in-range" bookmarks fold into the merged Trends tab.
  const tab = rawTab === 'in-range' ? 'trends' : rawTab;
  return panelRoute(name, tab);
}

export function hashToRoute(hash: string): Route {
  const value = decodeURIComponent(hash.replace(/^#/, ''));
  if (!value || value === 'panels') return { view: 'panels' };
  if (value === 'all') return legacyAllRoute(undefined);
  if (value.startsWith('all/')) return legacyAllRoute(value.slice('all/'.length));
  if (value.startsWith('panels/')) return parsePanelsHash(value.slice('panels/'.length));
  return (
    parseReferenceHash(value) ??
    parseReportsHash(value) ??
    parseBareViewHash(value) ??
    { view: 'panel', name: value } // back-compat with pre-nav-menu links
  );
}
