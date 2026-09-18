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
 * Medication bars portaled into `.med-lane-slot`, the first child of uPlot's
 * `.u-wrap`, so they paint behind the canvas by DOM order. Being behind
 * `.u-over` means no native `title` can fire, so hover is hit-tested by hand
 * on `.u-over`; alignment reads the chart's "lab-explore-view" event and live
 * rects, both re-resolved on every rebuild since `#makeChart()` recreates them.
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
      // uPlot sizes a new instance's `.u-over` a tick after firing this event, so measure once more next frame.
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

  // A new slot means lab-explore rebuilt its shadow DOM: measure again and re-attach the resize watcher.
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
