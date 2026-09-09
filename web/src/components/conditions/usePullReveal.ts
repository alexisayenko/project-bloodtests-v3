import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** How much of a scrolled-out header row / label column stays on screen as a grab handle. */
export const SLIVER = 5;

/** Share of the remaining extent a pull must cross before release settles it open. */
const COMMIT = 0.4;

/** A gesture shorter than this reads as a tap on the sliver, which toggles instead of dragging. */
const TAP_SLOP = 6;

export interface PullReveal {
  /** Currently revealed extent in px, between SLIVER and `full`. */
  reveal: number;
  open: boolean;
  dragging: boolean;
  toggle: () => void;
  collapse: () => void;
  /** Register on the handle as a non-passive `touchmove` listener. */
  claimTouch: (e: TouchEvent) => void;
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  };
}

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

/**
 * Drag-to-reveal for one axis: the thing sits at a SLIVER, follows the finger
 * while pulled, and on release either settles open (pulled past COMMIT) or
 * springs back. `full` is the extent when fully open -- a measured header
 * height or a fixed column width -- and may be 0 before it has been measured.
 */
export function usePullReveal(full: number, axis: 'x' | 'y'): PullReveal {
  const [open, setOpen] = useState(false);
  const [dragReveal, setDragReveal] = useState<number | null>(null);
  const origin = useRef(0);
  const travelled = useRef(0);
  const gesture = useRef({ live: false, open, axis });
  useEffect(() => {
    gesture.current.open = open;
    gesture.current.axis = axis;
  });

  /**
   * A handle parked at the top edge of the screen must not carry a blocking
   * `touch-action`, or a page scroll started on it goes nowhere. So the gesture
   * is claimed one move at a time, and only in the direction that actually
   * moves the panel -- which needs a non-passive listener React will not give
   * us through `onTouchMove`.
   */
  const claimTouch = useCallback((e: TouchEvent) => {
    const state = gesture.current;
    const touch = e.touches[0];
    if (!state.live || !e.cancelable || !touch) return;
    const delta = (state.axis === 'y' ? touch.clientY : touch.clientX) - origin.current;
    if (state.open ? delta < 0 : delta > 0) e.preventDefault();
  }, []);

  const closed = () => {
    setOpen(false);
    setDragReveal(null);
  };

  const at = (e: ReactPointerEvent<HTMLElement>) => (axis === 'y' ? e.clientY : e.clientX);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = at(e);
    travelled.current = 0;
    gesture.current.live = true;
    setDragReveal(open ? full : SLIVER);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (dragReveal === null) return;
    const delta = at(e) - origin.current;
    travelled.current = Math.max(travelled.current, Math.abs(delta));
    setDragReveal(clamp((open ? full : SLIVER) + delta, SLIVER, full));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    gesture.current.live = false;
    if (dragReveal === null) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // A 5px sliver is a poor drag target, so a tap on it is accepted as a
    // shortcut for the whole gesture.
    if (travelled.current < TAP_SLOP) setOpen(!open);
    else setOpen(dragReveal >= SLIVER + (full - SLIVER) * COMMIT);
    setDragReveal(null);
  };

  return {
    reveal: dragReveal ?? (open ? full : SLIVER),
    open,
    dragging: dragReveal !== null,
    toggle: () => setOpen(!open),
    collapse: closed,
    claimTouch,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
