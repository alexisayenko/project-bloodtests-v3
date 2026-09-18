import { describe, it, expect } from 'vitest';
import {
  ALL_OBSERVATIONS_PANEL,
  hashToRoute,
  routeToHash,
  isNavItemActive,
  isNavItemBlocked,
  isRouteBlocked,
  navItemRoute,
  panelRoute,
  NAV_ITEMS,
  type Route,
} from '../src/components/conditions/routing';

describe('nav item state', () => {
  const activeViews = (route: Route) => NAV_ITEMS.filter((item) => isNavItemActive(route, item.view)).map((item) => item.view);

  it('lights exactly one section, nesting Panel Detail and a report under their lists', () => {
    expect(activeViews({ view: 'panel', name: 'Thyroid' })).toEqual(['panels']);
    expect(activeViews({ view: 'report', file: 'dev__2024-06-15' })).toEqual(['reports']);
    expect(activeViews({ view: 'reference', key: 'homair' })).toEqual(['reference']);
    expect(activeViews({ view: 'plan' })).toEqual(['plan']);
  });

  it('lights All Observations for its pseudo-panel and Monitoring Panels for every other panel', () => {
    expect(activeViews({ view: 'panel', name: ALL_OBSERVATIONS_PANEL })).toEqual(['all']);
    expect(activeViews({ view: 'panel', name: 'Thyroid' })).toEqual(['panels']);
  });

  it('blocks Monitoring Panels, Hormonal Pathways, Lipid Transport and All Observations only while reports have errors', () => {
    expect(NAV_ITEMS.filter((item) => isNavItemBlocked(item.view, true)).map((item) => item.view)).toEqual(['all', 'panels', 'pathways', 'lipids']);
    expect(NAV_ITEMS.some((item) => isNavItemBlocked(item.view, false))).toBe(false);
  });

  it('blocks the panels grid, every panel (including All Observations) and Hormonal Pathways / Lipid Transport while reports have errors', () => {
    const blocked: Route[] = [
      { view: 'panels' },
      { view: 'panel', name: 'Thyroid' },
      { view: 'panel', name: ALL_OBSERVATIONS_PANEL },
      { view: 'panel', name: ALL_OBSERVATIONS_PANEL, tab: 'trends' },
      { view: 'pathways' },
      { view: 'lipids' },
    ];
    const open: Route[] = [
      { view: 'reports' },
      { view: 'report', file: 'dev__2024-06-15' },
      { view: 'profile' },
      { view: 'reference', key: 'homair' },
      { view: 'plan' },
      { view: 'medications' },
      { view: 'account' },
    ];
    for (const route of blocked) expect(isRouteBlocked(route, true)).toBe(true);
    for (const route of open) expect(isRouteBlocked(route, true)).toBe(false);
    for (const route of [...blocked, ...open]) expect(isRouteBlocked(route, false)).toBe(false);
  });

  it('agrees with the nav for every nav section', () => {
    for (const item of NAV_ITEMS) {
      expect(isNavItemBlocked(item.view, true)).toBe(isRouteBlocked(navItemRoute(item.view), true));
    }
  });
});

describe('navItemRoute', () => {
  it('routes All Observations to its pseudo-panel and every other item to its own simple route', () => {
    expect(navItemRoute('all')).toEqual({ view: 'panel', name: ALL_OBSERVATIONS_PANEL });
    expect(navItemRoute('panels')).toEqual({ view: 'panels' });
    expect(navItemRoute('pathways')).toEqual({ view: 'pathways' });
    expect(navItemRoute('account')).toEqual({ view: 'account' });
  });
});

describe('panelRoute', () => {
  it('collapses the default tab and an unknown segment to the bare panel route', () => {
    expect(panelRoute('Thyroid')).toEqual({ view: 'panel', name: 'Thyroid' });
    expect(panelRoute('Thyroid', 'analysis')).toEqual({ view: 'panel', name: 'Thyroid' });
    expect(panelRoute('Thyroid', 'nope')).toEqual({ view: 'panel', name: 'Thyroid' });
  });

  it('keeps a known non-default tab', () => {
    expect(panelRoute('Thyroid', 'trends')).toEqual({ view: 'panel', name: 'Thyroid', tab: 'trends' });
  });
});

describe('routeToHash ↔ hashToRoute', () => {
  const roundTrips: Route[] = [
    { view: 'panels' },
    { view: 'pathways' },
    { view: 'lipids' },
    { view: 'reference' },
    { view: 'reference', key: 'homair' },
    { view: 'reports' },
    { view: 'report', file: 'dev__2024-06-15' },
    { view: 'profile' },
    { view: 'medications' },
    { view: 'plan' },
    { view: 'account' },
    { view: 'panel', name: 'Bone and Mineral Metabolism' },
    { view: 'panel', name: 'Thyroid', tab: 'trends' },
    { view: 'panel', name: ALL_OBSERVATIONS_PANEL },
    { view: 'panel', name: ALL_OBSERVATIONS_PANEL, tab: 'trends' },
  ];

  it('round-trips every route shape', () => {
    for (const route of roundTrips) {
      expect([route, hashToRoute(routeToHash(route))]).toEqual([route, route]);
    }
  });

  it('a panel tab: the default and an unknown segment collapse to the bare panel hash', () => {
    expect(routeToHash({ view: 'panel', name: 'Thyroid', tab: 'trends' })).toBe('#panels/Thyroid/trends');
    expect(routeToHash({ view: 'panel', name: 'Thyroid', tab: 'analysis' })).toBe('#panels/Thyroid');
    expect(hashToRoute('#panels/Thyroid')).toEqual({ view: 'panel', name: 'Thyroid' });
    expect(hashToRoute('#panels/Thyroid/trends')).toEqual({ view: 'panel', name: 'Thyroid', tab: 'trends' });
    expect(hashToRoute('#panels/Thyroid/analysis')).toEqual({ view: 'panel', name: 'Thyroid' });
    expect(hashToRoute('#panels/Thyroid/nope')).toEqual({ view: 'panel', name: 'Thyroid' });
  });

  it('a legacy per-panel #panels/<name>/in-range bookmark folds into the merged Trends tab', () => {
    expect(hashToRoute('#panels/Thyroid/in-range')).toEqual({ view: 'panel', name: 'Thyroid', tab: 'trends' });
  });

  it('legacy #all links collapse onto the All Observations pseudo-panel, in-range folding into trends', () => {
    expect(hashToRoute('#all')).toEqual({ view: 'panel', name: ALL_OBSERVATIONS_PANEL });
    expect(hashToRoute('#all/analysis')).toEqual({ view: 'panel', name: ALL_OBSERVATIONS_PANEL });
    expect(hashToRoute('#all/trends')).toEqual({ view: 'panel', name: ALL_OBSERVATIONS_PANEL, tab: 'trends' });
    expect(hashToRoute('#all/in-range')).toEqual({ view: 'panel', name: ALL_OBSERVATIONS_PANEL, tab: 'trends' });
    expect(hashToRoute('#all/nope')).toEqual({ view: 'panel', name: ALL_OBSERVATIONS_PANEL });
    expect(hashToRoute('#all/')).toEqual({ view: 'panel', name: ALL_OBSERVATIONS_PANEL });
  });

  it('Hormonal Pathways lives at #pathways', () => {
    expect(routeToHash({ view: 'pathways' })).toBe('#pathways');
    expect(hashToRoute('#pathways')).toEqual({ view: 'pathways' });
  });

  it('Lipid Transport lives at #lipids', () => {
    expect(routeToHash({ view: 'lipids' })).toBe('#lipids');
    expect(hashToRoute('#lipids')).toEqual({ view: 'lipids' });
  });

  it('reference without a key maps to plain #reference', () => {
    expect(routeToHash({ view: 'reference' })).toBe('#reference');
  });

  it('empty hash lands on Monitoring Panels (the entry route)', () => {
    expect(hashToRoute('')).toEqual({ view: 'panels' });
    expect(hashToRoute('#')).toEqual({ view: 'panels' });
  });

  it('bare panel names stay readable (pre-nav-menu back-compat)', () => {
    expect(hashToRoute('#Hypogonadism')).toEqual({ view: 'panel', name: 'Hypogonadism' });
  });

  it('URL-encodes panel names with spaces', () => {
    expect(routeToHash({ view: 'panel', name: 'Insulin Resistance' })).toBe('#panels/Insulin%20Resistance');
  });
});

describe('NAV_ITEMS', () => {
  it('lists the ten top-level sections in order', () => {
    expect(NAV_ITEMS.map((i) => i.view)).toEqual(['profile', 'reports', 'all', 'panels', 'pathways', 'lipids', 'plan', 'medications', 'reference', 'account']);
  });
});
