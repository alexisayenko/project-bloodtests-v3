import { describe, it, expect } from 'vitest';
import { hashToRoute, routeToHash, isNavItemActive, isNavItemBlocked, isRouteBlocked, NAV_ITEMS, type Route } from '../src/components/conditions/routing';

describe('nav item state', () => {
  const activeViews = (route: Route) => NAV_ITEMS.filter((item) => isNavItemActive(route, item.view)).map((item) => item.view);

  it('lights exactly one section, nesting Panel Detail and a report under their lists', () => {
    expect(activeViews({ view: 'panel', name: 'Thyroid' })).toEqual(['panels']);
    expect(activeViews({ view: 'report', file: 'dev__2024-06-15' })).toEqual(['reports']);
    expect(activeViews({ view: 'reference', key: 'homair' })).toEqual(['reference']);
    expect(activeViews({ view: 'plan' })).toEqual(['plan']);
  });

  it('blocks Monitoring Panels and All Observations only while reports have errors', () => {
    expect(NAV_ITEMS.filter((item) => isNavItemBlocked(item.view, true)).map((item) => item.view)).toEqual(['all', 'panels']);
    expect(NAV_ITEMS.some((item) => isNavItemBlocked(item.view, false))).toBe(false);
  });

  it('blocks the panels grid, Panel Detail and every All Observations tab while reports have errors', () => {
    const blocked: Route[] = [
      { view: 'panels' },
      { view: 'panel', name: 'Thyroid' },
      { view: 'all' },
      { view: 'all', tab: 'in-range' },
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
      expect(isNavItemBlocked(item.view, true)).toBe(isRouteBlocked({ view: item.view }, true));
    }
  });
});

describe('routeToHash ↔ hashToRoute', () => {
  const roundTrips: Route[] = [
    { view: 'panels' },
    { view: 'reference' },
    { view: 'reference', key: 'homair' },
    { view: 'all' },
    { view: 'all', tab: 'in-range' },
    { view: 'all', tab: 'trends' },
    { view: 'reports' },
    { view: 'report', file: 'dev__2024-06-15' },
    { view: 'profile' },
    { view: 'medications' },
    { view: 'plan' },
    { view: 'account' },
    { view: 'panel', name: 'Bone and Mineral Metabolism' },
  ];

  it('round-trips every route shape', () => {
    for (const route of roundTrips) {
      expect([route, hashToRoute(routeToHash(route))]).toEqual([route, route]);
    }
  });

  it('All Observations tabs: #all/in-range addresses a tab, the default and an unknown segment collapse to #all', () => {
    expect(routeToHash({ view: 'all', tab: 'in-range' })).toBe('#all/in-range');
    expect(routeToHash({ view: 'all', tab: 'analysis' })).toBe('#all');
    expect(hashToRoute('#all')).toEqual({ view: 'all' });
    expect(hashToRoute('#all/in-range')).toEqual({ view: 'all', tab: 'in-range' });
    expect(hashToRoute('#all/analysis')).toEqual({ view: 'all' });
    expect(hashToRoute('#all/nope')).toEqual({ view: 'all' });
    expect(hashToRoute('#all/')).toEqual({ view: 'all' });
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
  it('lists the eight top-level sections in order', () => {
    expect(NAV_ITEMS.map((i) => i.view)).toEqual(['profile', 'reports', 'all', 'panels', 'plan', 'medications', 'reference', 'account']);
  });
});
