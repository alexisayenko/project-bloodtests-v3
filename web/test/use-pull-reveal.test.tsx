// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePullReveal, SLIVER, type PullReveal } from '../src/components/conditions/usePullReveal';

let latest: PullReveal;
let root: Root | null = null;
let container: HTMLDivElement;

function Harness({ full, axis }: Readonly<{ full: number; axis: 'x' | 'y' }>) {
  const reveal = usePullReveal(full, axis);
  useEffect(() => {
    latest = reveal;
  });
  return null;
}

async function mount(full = 100, axis: 'x' | 'y' = 'y'): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness full={full} axis={axis} />);
  });
}

const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };

function pointer(y: number, x = 0): ReactPointerEvent<HTMLElement> {
  return { pointerId: 1, clientX: x, clientY: y, currentTarget: target } as unknown as ReactPointerEvent<HTMLElement>;
}

const down = (y: number, x?: number) => act(async () => latest.handlers.onPointerDown(pointer(y, x)));
const move = (y: number, x?: number) => act(async () => latest.handlers.onPointerMove(pointer(y, x)));
const up = (y: number, x?: number) => act(async () => latest.handlers.onPointerUp(pointer(y, x)));

function touch(y: number, cancelable = true) {
  const preventDefault = vi.fn();
  const e = { touches: [{ clientX: 0, clientY: y }], cancelable, preventDefault } as unknown as TouchEvent;
  return { e, preventDefault };
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

describe('usePullReveal', () => {
  it('rests closed at the sliver', async () => {
    await mount();
    expect(latest.reveal).toBe(SLIVER);
    expect(latest.open).toBe(false);
    expect(latest.dragging).toBe(false);
  });

  it('follows the finger while pulled, clamped between the sliver and full', async () => {
    await mount(100);
    await down(10);
    expect(latest.dragging).toBe(true);
    await move(40);
    expect(latest.reveal).toBe(SLIVER + 30);
    await move(500);
    expect(latest.reveal).toBe(100);
    await move(-50);
    expect(latest.reveal).toBe(SLIVER);
  });

  it('settles open once released past 40% of the remaining travel', async () => {
    await mount(105);
    await down(0);
    await move(41);
    await up(41);
    expect(latest.open).toBe(true);
    expect(latest.reveal).toBe(105);
    expect(latest.dragging).toBe(false);
  });

  it('springs back when released short of the commit point', async () => {
    await mount(105);
    await down(0);
    await move(39);
    await up(39);
    expect(latest.open).toBe(false);
    expect(latest.reveal).toBe(SLIVER);
  });

  it('reads a sub-6px gesture as a tap that toggles', async () => {
    await mount();
    await down(0);
    await move(3);
    await up(3);
    expect(latest.open).toBe(true);
    await down(0);
    await move(-2);
    await up(-2);
    expect(latest.open).toBe(false);
  });

  it('pulls back closed from open along the same rule', async () => {
    await mount(105);
    await act(async () => latest.toggle());
    expect(latest.reveal).toBe(105);
    await down(0);
    await move(-70);
    expect(latest.reveal).toBe(35);
    await up(-70);
    expect(latest.open).toBe(false);
    await act(async () => latest.toggle());
    await down(0);
    await move(-50);
    await up(-50);
    expect(latest.open).toBe(true);
  });

  it('reads the x axis when asked to', async () => {
    await mount(100, 'x');
    await down(0, 0);
    await move(999, 30);
    expect(latest.reveal).toBe(SLIVER + 30);
  });

  it('claims a touch only while live and only in the direction that moves the panel', async () => {
    await mount();
    const idle = touch(50);
    latest.claimTouch(idle.e);
    expect(idle.preventDefault).not.toHaveBeenCalled();

    await down(10);
    const pulling = touch(50);
    latest.claimTouch(pulling.e);
    expect(pulling.preventDefault).toHaveBeenCalledTimes(1);

    const pushing = touch(-30);
    latest.claimTouch(pushing.e);
    expect(pushing.preventDefault).not.toHaveBeenCalled();

    const uncancelable = touch(50, false);
    latest.claimTouch(uncancelable.e);
    expect(uncancelable.preventDefault).not.toHaveBeenCalled();

    await up(10);
    const released = touch(50);
    latest.claimTouch(released.e);
    expect(released.preventDefault).not.toHaveBeenCalled();
  });

  it('collapses back to the sliver on demand', async () => {
    await mount();
    await act(async () => latest.toggle());
    expect(latest.open).toBe(true);
    await act(async () => latest.collapse());
    expect(latest.open).toBe(false);
    expect(latest.reveal).toBe(SLIVER);
  });
});
