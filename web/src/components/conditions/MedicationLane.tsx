import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { MedicationBar } from './medicationBars';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';

type ViewRange = { xmin: number; xmax: number };
type PlotRect = { left: number; width: number };

const ROW_HEIGHT = 18;
const ROW_GAP = 4;
const BAR_HEIGHT = 12;
const LABEL_MIN_WIDTH = 42;

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
 * The medication-history lane under a panel's/All Observations' "What's in
 * range" chart (task-0053) -- one thin row per medication, bars spanning its
 * active months, aligned to the SAME visible x-window as the vendored
 * <lab-explore> chart above it.
 *
 * Rendered via a portal into `.med-lane-slot`, an anchor lab-explore.ts's
 * template places right under the chart and above its own marker picker --
 * without it, this component could only ever mount as a sibling AFTER the
 * whole <lab-explore> element, i.e. below the picker too, not under the
 * chart it needs to align with.
 *
 * Alignment itself rides on two things read across that element's OPEN
 * shadow root rather than duplicated here: the "lab-explore-view" CustomEvent
 * lab-explore.ts dispatches with the chart's current {xmin, xmax} on every
 * pan/zoom/rebuild, and the real pixel rect of its `.u-over` plotting-area
 * element -- so a date lines up with the same date above it without this
 * component reimplementing uPlot's own axis-gutter math. Both the slot and
 * the plot rect are re-read on every such event, since a full model change
 * (unit system, normalized toggle) recreates all three of them.
 */
export function MedicationLane({
  bars,
  hostRef,
}: Readonly<{
  bars: MedicationBar[];
  hostRef: RefObject<HTMLElement | null>;
}>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [view, setView] = useState<ViewRange | null>(null);
  const [plotRect, setPlotRect] = useState<PlotRect | null>(null);

  const measure = useCallback(() => {
    const host = hostRef.current;
    const container = containerRef.current;
    const over = host?.shadowRoot?.querySelector<HTMLElement>('.u-over');
    if (!host || !container || !over) return;
    const overRect = over.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setPlotRect({ left: overRect.left - containerRect.left, width: overRect.width });
  }, [hostRef]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const findSlot = () => host.shadowRoot?.querySelector<HTMLElement>('.med-lane-slot') ?? null;

    const onView = (e: Event) => {
      setView((e as CustomEvent<ViewRange>).detail);
      setSlot(findSlot());
      measure();
    };
    host.addEventListener('lab-explore-view', onView);
    setSlot(findSlot());

    return () => host.removeEventListener('lab-explore-view', onView);
  }, [hostRef, measure]);

  // The slot found above only takes effect once React commits the portal's
  // container into it on the NEXT render, so the render where `slot` first
  // appears still needs its own measurement -- this is that one. It also
  // re-attaches the resize watcher to the CURRENT `.chart-wrap`, since a
  // slot change means lab-explore.ts just rebuilt its whole shadow DOM.
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

  return createPortal(
    <div ref={containerRef} style={{ position: 'relative', margin: `${SPACE[4]} 0` }}>
      {ready && <div style={{ fontSize: 12, color: COLOR.textMuted, marginBottom: SPACE[2] }}>Medications</div>}
      <div style={{ position: 'relative' }}>
        {rows.map((row) => (
          <div key={row.brand} style={{ position: 'relative', height: ROW_HEIGHT + ROW_GAP }}>
            {row.bars.map((bar) => {
              const left = Math.max(xPos(bar.startTs), plotRect!.left);
              const right = Math.min(xPos(bar.endTs), plotRight);
              const width = right - left;
              if (width <= 0) return null;
              return (
                <div
                  key={bar.id}
                  title={`${bar.brand}${bar.detail ? ' · ' + bar.detail : ''}`}
                  aria-label={`${bar.brand}${bar.detail ? ' · ' + bar.detail : ''}`}
                  style={{
                    position: 'absolute',
                    left,
                    width: Math.max(2, width),
                    top: ROW_GAP / 2,
                    height: BAR_HEIGHT,
                    background: bar.color,
                    borderRadius: RADIUS.pill,
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    cursor: 'default',
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
      </div>
    </div>,
    slot
  );
}
