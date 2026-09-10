import { describe, it, expect } from 'vitest';
import { hashToRoute, routeToHash, NAV_ITEMS, type Route } from '../src/components/conditions/routing';

describe('routeToHash ↔ hashToRoute', () => {
  const roundTrips: Route[] = [
    { view: 'panels' },
    { view: 'reference' },
    { view: 'reference', key: 'homair' },
    { view: 'all' },
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
