// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { useHashRoute } from '../src/hooks/useHashRoute';
import type { Route } from '../src/components/conditions/routing';
import { mount, unmount } from './helpers/render';

let latest: { route: Route; navigate: (next: Route) => void };
let frames: FrameRequestCallback[] = [];

function Harness({ blocked }: Readonly<{ blocked: boolean }>) {
  latest = useHashRoute(blocked);
  return null;
}

const flushFrames = () => {
  const pending = frames;
  frames = [];
  for (const cb of pending) cb(0);
};

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
}

async function popTo(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

const navigate = (next: Route) => act(async () => latest.navigate(next));

beforeEach(() => {
  frames = [];
  setScrollY(0);
  window.location.hash = '';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window.history, 'pushState');
  vi.spyOn(window.history, 'replaceState');
});

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useHashRoute', () => {
  it('reads the initial route from the URL hash', async () => {
    window.location.hash = '#plan';
    await mount(<Harness blocked={false} />);
    expect(latest.route).toEqual({ view: 'plan' });
  });

  it('navigate pushes the new hash and updates the route', async () => {
    await mount(<Harness blocked={false} />);
    await navigate({ view: 'panel', name: 'Hypogonadism' });
    expect(latest.route).toEqual({ view: 'panel', name: 'Hypogonadism' });
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '#panels/Hypogonadism');
  });

  it('follows the browser back and forward through popstate', async () => {
    await mount(<Harness blocked={false} />);
    await popTo('#all/in-range');
    expect(latest.route).toEqual({ view: 'all', tab: 'in-range' });
    await popTo('#reports');
    expect(latest.route).toEqual({ view: 'reports' });
  });

  it('restores the grid scroll position when a panel is left through the chevron', async () => {
    await mount(<Harness blocked={false} />);
    setScrollY(640);
    await navigate({ view: 'panel', name: 'Hypogonadism' });
    setScrollY(0);
    await navigate({ view: 'panels' });
    expect(window.scrollTo).not.toHaveBeenCalled();
    flushFrames();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 640);
  });

  it('restores the grid scroll position when a panel is left through browser Back', async () => {
    await mount(<Harness blocked={false} />);
    setScrollY(320);
    await navigate({ view: 'panel', name: 'Hypogonadism' });
    await popTo('#panels');
    flushFrames();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 320);
  });

  it('consumes the saved position once; a return through Forward and Back alone restores nothing', async () => {
    await mount(<Harness blocked={false} />);
    setScrollY(320);
    await navigate({ view: 'panel', name: 'Hypogonadism' });
    await popTo('#panels');
    flushFrames();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    await popTo('#panels/Hypogonadism');
    await popTo('#panels');
    flushFrames();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('does not capture the scroll position for any other transition', async () => {
    await mount(<Harness blocked={false} />);
    setScrollY(500);
    await navigate({ view: 'plan' });
    await navigate({ view: 'panels' });
    flushFrames();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('redirects a blocked route to reports and replaces the URL rather than pushing it', async () => {
    window.location.hash = '#panels';
    await mount(<Harness blocked />);
    expect(latest.route).toEqual({ view: 'reports' });
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '#reports');
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it('redirects when navigating into a blocked route', async () => {
    window.location.hash = '#reports';
    await mount(<Harness blocked />);
    await navigate({ view: 'all' });
    expect(latest.route).toEqual({ view: 'reports' });
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '#reports');
  });

  it('leaves a reachable route alone while errors exist', async () => {
    window.location.hash = '#plan';
    await mount(<Harness blocked />);
    expect(latest.route).toEqual({ view: 'plan' });
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', async () => {
    await mount(<Harness blocked={false} />);
    const before = latest.route;
    unmount();
    window.location.hash = '#plan';
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(latest.route).toBe(before);
  });
});
