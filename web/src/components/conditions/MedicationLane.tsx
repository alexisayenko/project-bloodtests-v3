import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { MedicationBar } from './medicationBars';
import { RADIUS } from '../../styles/tokens';

type ViewRange = { xmin: number; xmax: number };
type PlotRect = { left: number; top: number; width: number };

const ROW_HEIGHT = 18;
const ROW_GAP = 4;
const BAR_HEIGHT = 12;
const LABEL_MIN_WIDTH = 42;
const PAD_TOP = 6;

function groupByBrand(bars: MedicationBar[]): { brand: string; bars: MedicationBar[] }[] {
  const order: string[] = [];
  const byBrand = new Map<string, MedicationBar[]>();
  for (const bar of bars) {
    if (!byBrand.has(bar.brand)) {
      byBrand.set(bar.brand, []);
      order.push(bar.brand);
    }
    byBrand.get(bar.brand)!.push(bar);
  }
  return order.map((brand) => ({ brand, bars: byBrand.get(brand)! }));
}

/**
 * The medication-history lane inside a panel's/All Observations' "What's in
 * range" chart -- one thin row per medication, bars spanning its active
 * months, stacked as a strip near the top of the plot area, aligned to the
 * SAME visible x-window as the vendored <lab-explore> chart around it and
 * drawn BEHIND its data lines.
 *
 * "Behind" is real z-order, not a tint: this renders via a portal into
 * `.med-lane-slot`, an anchor lab-explore.ts's `#makeChart()` inserts as the
 * very FIRST child of uPlot's own `.u-wrap` on every (re)build -- ahead of
 * `.u-under` (the canvas that actually paints the grid, the reference band
 * and the series strokes) in DOM order, which is what uPlot itself uses as
 * paint order since none of its layers set z-index. The bars sit fully
 * behind the canvas; wherever it draws an opaque or translucent pixel, that
 * pixel wins.
 *
 * That same behind-the-canvas placement also means the bars sit behind
 * `.u-over`, uPlot's transparent interactive overlay, which is what actually
 * receives pointer events for the whole plot (crosshair, drag-pan) -- so a
 * native `title` on a bar element would never fire; the browser always hit-
 * tests the topmost painted element. Hover is therefore done by hand: a
 * `mousemove`/`mouseleave` pair bound directly to `.u-over`, hit-testing the
 * cursor against each bar's live `getBoundingClientRect()`, with the result
 * shown in a small tooltip portaled into `.u-over` itself using its existing
 * `.u-tip` class -- the same DOM home and look the chart's own point tooltip
 * (chart-kit's `tooltip()`) already uses, so it paints on top like that one
 * does, with no new CSS.
 *
 * Alignment itself rides on two things read across the element's OPEN shadow
 * root rather than duplicated here: the "lab-explore-view" CustomEvent
 * lab-explore.ts dispatches with the chart's current {xmin, xmax} on every
 * pan/zoom/rebuild, and the real pixel rects of `.u-wrap`'s `.med-lane-slot`
 * and `.u-over` -- so a date lines up with the same date in the chart above
 * it without this component reimplementing uPlot's own axis-gutter math.
 * Both `.u-wrap` and `.u-over` are destroyed and recreated by `#makeChart()`
 * on every rebuild (a marker toggle included, not just `#render()`), so the
 * portal targets and the `.u-over` listeners are all re-resolved on every
 * such event rather than assumed stable.
 */
export function MedicationLane({
  bars,
  hostRef,
}: Readonly<{
  bars: MedicationBar[];
  hostRef: RefObject<HTMLElement | null>;
}>) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [overEl, setOverEl] = useState<HTMLElement | null>(null);
  const [view, setView] = useState<ViewRange | null>(null);
  const [plotRect, setPlotRect] = useState<PlotRect | null>(null);
  const [hover, setHover] = useState<{ bar: MedicationBar; x: number; y: number } | null>(null);

  const barsRef = useRef(bars);
  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);
  const barElsRef = useRef(new Map<string, HTMLElement>());
  const overNodeRef = useRef<HTMLElement | null>(null);

  const onMove = useCallback((e: MouseEvent) => {
    const over = e.currentTarget as HTMLElement;
    const overRect = over.getBoundingClientRect();
    let found: MedicationBar | null = null;
    for (const bar of barsRef.current) {
      const el = barElsRef.current.get(bar.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        found = bar;
        break;
      }
    }
    setHover(found ? { bar: found, x: e.clientX - overRect.left, y: e.clientY - overRect.top } : null);
  }, []);

  const onLeave = useCallback(() => setHover(null), []);

  const measure = useCallback(() => {
    const host = hostRef.current;
    const root = host?.shadowRoot;
    const over = root?.querySelector<HTMLElement>('.u-over') ?? null;
    const foundSlot = root?.querySelector<HTMLElement>('.med-lane-slot') ?? null;
    setSlot(foundSlot);
    setOverEl(over);

    if (overNodeRef.current !== over) {
      overNodeRef.current?.removeEventListener('mousemove', onMove);
      overNodeRef.current?.removeEventListener('mouseleave', onLeave);
      over?.addEventListener('mousemove', onMove);
      over?.addEventListener('mouseleave', onLeave);
      overNodeRef.current = over;
      setHover(null);
    }

    if (!over || !foundSlot) return;
    const overRect = over.getBoundingClientRect();
    const slotRect = foundSlot.getBoundingClientRect();
    setPlotRect({ left: overRect.left - slotRect.left, top: overRect.top - slotRect.top, width: overRect.width });
  }, [hostRef, onMove, onLeave]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onViewEvent = (e: Event) => {
      setView((e as CustomEvent<ViewRange>).detail);
      measure();
      // A rebuild (marker toggle, model swap) fires this event the instant its
      // NEW uPlot instance is constructed, but uPlot applies that instance's own
      // DOM sizing (`.u-over`'s rect) a tick later -- so the measurement just
      // above can read a stale/zero rect. One more pass next frame, once uPlot
      // has actually settled, catches that case; on pan/zoom (`.u-wrap` unchanged)
      // it just reconfirms the same numbers.
      requestAnimationFrame(measure);
    };
    host.addEventListener('lab-explore-view', onViewEvent);
    measure();

    return () => {
      host.removeEventListener('lab-explore-view', onViewEvent);
      overNodeRef.current?.removeEventListener('mousemove', onMove);
      overNodeRef.current?.removeEventListener('mouseleave', onLeave);
      overNodeRef.current = null;
    };
  }, [hostRef, measure, onMove, onLeave]);

  // The slot found above only takes effect for the bars' own portal once React
  // commits it into the DOM on the NEXT render, so the render where `slot`
  // first appears still needs its own measurement -- this is that one. It also
  // re-attaches the resize watcher to the CURRENT `.chart-wrap`, since a slot
  // change means lab-explore.ts just rebuilt its whole shadow DOM.
  useEffect(() => {
    if (!slot) return;
    measure();
    const wrap = hostRef.current?.shadowRoot?.querySelector('.chart-wrap');
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [slot, hostRef, measure]);

  if (bars.length === 0 || !slot) return null;

  const ready = !!view && !!plotRect && view.xmax > view.xmin;
  const rows = ready ? groupByBrand(bars) : [];
  const plotRight = ready ? plotRect!.left + plotRect!.width : 0;
  const xPos = (ts: number) => plotRect!.left + ((ts - view!.xmin) / (view!.xmax - view!.xmin)) * plotRect!.width;

  const lane = createPortal(
    <>
      {rows.map((row, i) => (
        <div
          key={row.brand}
          style={{ position: 'absolute', left: 0, right: 0, top: plotRect!.top + PAD_TOP + i * (ROW_HEIGHT + ROW_GAP), height: ROW_HEIGHT }}
        >
          {row.bars.map((bar) => {
            const left = Math.max(xPos(bar.startTs), plotRect!.left);
            const right = Math.min(xPos(bar.endTs), plotRight);
            const width = right - left;
            if (width <= 0) return null;
            return (
              <div
                key={bar.id}
                ref={(el) => {
                  if (el) barElsRef.current.set(bar.id, el);
                  else barElsRef.current.delete(bar.id);
                }}
                aria-label={`${bar.brand}${bar.detail ? ' · ' + bar.detail : ''}`}
                style={{
                  position: 'absolute',
                  left,
                  width: Math.max(2, width),
                  top: 0,
                  height: BAR_HEIGHT,
                  background: bar.color,
                  borderRadius: RADIUS.pill,
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                }}
              >
                {width > LABEL_MIN_WIDTH && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: '#fff',
                      padding: '0 6px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {bar.brand}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>,
    slot
  );

  const tip =
    hover && overEl
      ? createPortal(
          <div className="u-tip" style={{ display: 'block', transform: `translate(${hover.x + 14}px, ${hover.y + 14}px)` }}>
            <div className="u-tip-row">
              {hover.bar.brand}
              {hover.bar.detail ? ` · ${hover.bar.detail}` : ''}
            </div>
          </div>,
          overEl
        )
      : null;

  return (
    <>
      {lane}
      {tip}
    </>
  );
}
