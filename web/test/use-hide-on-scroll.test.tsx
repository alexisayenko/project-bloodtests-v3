// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useHideOnScroll } from '../src/components/conditions/useHideOnScroll';

let frames: FrameRequestCallback[] = [];
let root: Root | null = null;
let container: HTMLDivElement;

function Harness({ threshold }: Readonly<{ threshold?: number }>) {
  const hidden = useHideOnScroll(threshold);
  return <div data-hidden={String(hidden)} />;
}

const hidden = () => container.querySelector('div')!.dataset.hidden;

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
}

async function scrollTo(y: number): Promise<void> {
  setScrollY(y);
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
    const pending = frames;
    frames = [];
    for (const cb of pending) cb(0);
  });
}

async function mount(threshold?: number): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness threshold={threshold} />);
  });
}

beforeEach(() => {
  frames = [];
  setScrollY(0);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container.remove();
  vi.unstubAllGlobals();
});

describe('useHideOnScroll', () => {
  it('starts shown', async () => {
    await mount();
    expect(hidden()).toBe('false');
  });

  it('hides once the page is scrolled down past the threshold', async () => {
    await mount();
    await scrollTo(50);
    expect(hidden()).toBe('true');
  });

  it('ignores jitter smaller than the threshold in either direction', async () => {
    await mount();
    await scrollTo(50);
    await scrollTo(45);
    expect(hidden()).toBe('true');
    await scrollTo(52);
    expect(hidden()).toBe('true');
  });

  it('shows again on the first real scroll back up', async () => {
    await mount();
    await scrollTo(200);
    await scrollTo(180);
    expect(hidden()).toBe('false');
  });

  it('is always shown within the top zone, whatever came before', async () => {
    await mount();
    await scrollTo(200);
    expect(hidden()).toBe('true');
    await scrollTo(3);
    expect(hidden()).toBe('false');
  });

  it('measures once per frame however many scroll events arrive', async () => {
    await mount();
    setScrollY(80);
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });
    expect(frames).toHaveLength(1);
    await scrollTo(80);
    expect(hidden()).toBe('true');
  });

  it('honours a custom threshold', async () => {
    await mount(100);
    await scrollTo(60);
    expect(hidden()).toBe('false');
    await scrollTo(160);
    expect(hidden()).toBe('true');
  });

  it('stops listening once unmounted', async () => {
    await mount();
    await act(async () => {
      root!.unmount();
    });
    root = null;
    setScrollY(300);
    window.dispatchEvent(new Event('scroll'));
    expect(frames).toHaveLength(0);
  });
});
