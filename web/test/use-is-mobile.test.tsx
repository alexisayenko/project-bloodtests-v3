// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useIsMobile, MOBILE_QUERY } from '../src/hooks/useIsMobile';

type Listener = () => void;

const media = {
  matches: false,
  queries: [] as string[],
  listeners: new Set<Listener>(),
  fire() {
    for (const l of this.listeners) l();
  },
};

function fakeMatchMedia(query: string) {
  media.queries.push(query);
  return {
    get matches() {
      return media.matches;
    },
    addEventListener: (_type: string, l: Listener) => void media.listeners.add(l),
    removeEventListener: (_type: string, l: Listener) => void media.listeners.delete(l),
  };
}

let root: Root | null = null;
let container: HTMLDivElement;

function Harness() {
  const mobile = useIsMobile();
  return <div data-mobile={String(mobile)} />;
}

async function mount(): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness />);
  });
}

const rendered = () => container.querySelector('div')!.dataset.mobile;

beforeEach(() => {
  media.matches = false;
  media.queries = [];
  media.listeners.clear();
  vi.stubGlobal('matchMedia', fakeMatchMedia);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container.remove();
  vi.unstubAllGlobals();
});

describe('useIsMobile', () => {
  it('asks the stylesheet\'s own breakpoint', async () => {
    await mount();
    expect(MOBILE_QUERY).toBe('(max-width: 767px)');
    expect(new Set(media.queries)).toEqual(new Set([MOBILE_QUERY]));
  });

  it('starts false on a wide viewport', async () => {
    await mount();
    expect(rendered()).toBe('false');
  });

  it('starts true on a narrow viewport', async () => {
    media.matches = true;
    await mount();
    expect(rendered()).toBe('true');
  });

  it('follows the viewport across the breakpoint in both directions', async () => {
    await mount();
    media.matches = true;
    await act(async () => media.fire());
    expect(rendered()).toBe('true');
    media.matches = false;
    await act(async () => media.fire());
    expect(rendered()).toBe('false');
  });

  it('stops listening once unmounted', async () => {
    await mount();
    expect(media.listeners.size).toBe(1);
    await act(async () => {
      root!.unmount();
    });
    root = null;
    expect(media.listeners.size).toBe(0);
  });
});
