import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { SLIVER, usePullReveal } from './usePullReveal';
import { LABEL_COL_WIDTH, RESULT_TABLE } from './ui';

/** Invisible drag target around the column sliver: 5px is nowhere near a thumb-sized handle. */
const GRAB = 22;

/**
 * The header's handle is deliberately thin -- it straddles the sliver and
 * nothing more, because it sits at the top edge of the screen where a wide
 * target used to eat page scrolling. The chip is the target you are meant to
 * hit; this is only the shortcut for people who find the sliver.
 */
const GRAB_HEAD = SLIVER * 2;

/** Clear of the header's own edge, so the chip never sits on the date row it toggles. */
const CHIP_GAP = 6;

/** Below this much table left under the sliver there is nothing worth labelling. */
const MIN_BODY = 32;

/** The nav publishes its own height here, so a revealed header parks under it rather than behind it. */
function navOffset(): number {
  const px = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mc-nav-offset'));
  return Number.isFinite(px) ? px : 0;
}

/**
 * The horizontally scrolling box around a results table, plus -- on mobile only
 * -- the pull-to-reveal handles for the two things that scroll out of it: the
 * date header row (off the top, with the page) and the marker-name column (off
 * the left, with this box). Neither is pinned; each leaves a SLIVER you drag or
 * tap open, and collapses again on the next scroll or a tap elsewhere.
 *
 * The column reveal is the real first column, held by `position: sticky` at a
 * negative offset, so it can never drift out of line with the rows. The header
 * reveal has to be a copy -- vertical sticky would resolve against this
 * scrolling box rather than the page -- and it is kept aligned by rendering the
 * SAME colgroup and thead inside a box of the same width, with the horizontal
 * scroll mirrored onto it. It also gets the floating "Dates" chip, which is the
 * control people are actually expected to find; the pull is the shortcut.
 */
export function TableScroller({
  colgroup,
  head,
  children,
}: Readonly<{ colgroup: ReactNode; head: ReactNode; children: ReactNode }>) {
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const headGrabRef = useRef<HTMLDivElement>(null);
  const colGrabRef = useRef<HTMLButtonElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [box, setBox] = useState({ left: 0, width: 0 });
  const [headHeight, setHeadHeight] = useState(0);
  const [headerCut, setHeaderCut] = useState(false);

  const header = usePullReveal(headHeight, 'y');
  const column = usePullReveal(LABEL_COL_WIDTH, 'x');

  // Read by listeners that must not re-subscribe on every drag frame.
  const live = useRef({ header, column });
  useEffect(() => {
    live.current = { header, column };
  });

  useEffect(() => {
    if (!isMobile) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const wrap = wrapRef.current;
      const thead = wrap?.querySelector('thead');
      const table = wrap?.querySelector('table');
      if (!wrap || !thead || !table) return;
      const wrapRect = wrap.getBoundingClientRect();
      const headRect = thead.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const top = navOffset();
      const left = wrapRect.left;
      const width = wrap.clientWidth;
      setBox((prev) => (prev.left === left && prev.width === width ? prev : { left, width }));
      setHeadHeight(headRect.height);
      setHeaderCut(headRect.bottom <= top + 1 && tableRect.bottom > top + SLIVER + MIN_BODY);
    };

    const onScroll = () => {
      const { header: h, column: c } = live.current;
      if (!h.dragging && !c.dragging) {
        h.collapse();
        c.collapse();
      }
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isMobile]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!isMobile || !wrap) return;
    const onScroll = () => {
      setScrollLeft(wrap.scrollLeft);
      // Only the column reveal lives on this axis; a header left open follows
      // the scroll instead, which is how you read across to a far date.
      if (!live.current.column.dragging) live.current.column.collapse();
    };
    wrap.addEventListener('scroll', onScroll, { passive: true });
    return () => wrap.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  const anyOpen = header.open || column.open;
  useEffect(() => {
    if (!anyOpen) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest('[data-mc-reveal]')) return;
      live.current.header.collapse();
      live.current.column.collapse();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [anyOpen]);

  const colHidden = LABEL_COL_WIDTH - column.reveal;
  const wrapClass = [
    'mc-table-wrap',
    column.dragging ? '' : 'mc-col-animated',
    scrollLeft > SLIVER ? 'mc-col-cut' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const showHeader = isMobile && headerCut && headHeight > 0;
  const showColumn = isMobile && scrollLeft > SLIVER;

  // Non-passive, so the handle can take the one direction it needs instead of
  // reserving an axis up front with `touch-action`; React only offers passive.
  const headerClaim = header.claimTouch;
  const columnClaim = column.claimTouch;
  useEffect(() => {
    const head = headGrabRef.current;
    const col = colGrabRef.current;
    head?.addEventListener('touchmove', headerClaim, { passive: false });
    col?.addEventListener('touchmove', columnClaim, { passive: false });
    return () => {
      head?.removeEventListener('touchmove', headerClaim);
      col?.removeEventListener('touchmove', columnClaim);
    };
  }, [showHeader, showColumn, headerClaim, columnClaim]);
  // Keyboard activation of a <button> arrives as a click with no pointer
  // detail; pointer taps are already handled by the drag gesture itself.
  const keyOnly = (toggle: () => void) => (e: { detail: number }) => {
    if (e.detail === 0) toggle();
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={wrapRef}
        className={wrapClass}
        style={{ overflowX: 'auto', '--mc-col-left': `${-colHidden}px` } as CSSProperties}
      >
        <table style={RESULT_TABLE}>
          {colgroup}
          {head}
          {children}
        </table>
      </div>

      {showColumn && (
        <button
          type="button"
          data-mc-reveal
          className="mc-grab-col"
          aria-label={column.open ? 'Hide the marker names' : 'Pull right to show the marker names'}
          // Rides the column's own moving edge, so an open column stays tappable behind it.
          style={{ left: Math.max(0, column.reveal - GRAB / 2), width: GRAB, touchAction: 'pan-y' }}
          onClick={keyOnly(column.toggle)}
          ref={colGrabRef}
          {...column.handlers}
        />
      )}

      {showHeader && (
        <>
          <div
            data-mc-reveal
            className={`mc-head-reveal${header.dragging ? '' : ' mc-animated'}`}
            style={
              {
                left: box.left,
                width: box.width,
                height: header.reveal,
                '--mc-corner-x': `${Math.max(0, scrollLeft - colHidden)}px`,
              } as CSSProperties
            }
          >
            <div style={{ transform: `translate(${-scrollLeft}px, ${header.reveal - headHeight}px)` }}>
              <table style={RESULT_TABLE}>
                {colgroup}
                {head}
              </table>
            </div>
          </div>
          <div
            aria-hidden
            data-mc-reveal
            className="mc-grab-head"
            style={{
              left: box.left,
              width: box.width,
              top: `calc(var(--mc-nav-offset, 0px) + ${header.reveal - SLIVER}px)`,
              height: GRAB_HEAD,
            }}
            ref={headGrabRef}
            {...header.handlers}
          />
          <button
            type="button"
            data-mc-reveal
            className={`mc-dates-chip${header.dragging ? '' : ' mc-animated'}`}
            aria-expanded={header.open}
            aria-label={header.open ? 'Hide dates' : 'Show dates'}
            style={{ top: `calc(var(--mc-nav-offset, 0px) + ${header.reveal + CHIP_GAP}px)` }}
            onClick={header.toggle}
          >
            Dates
            <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
              <path
                d="M1 1L5 5L9 1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
