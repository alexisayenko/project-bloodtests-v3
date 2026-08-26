/**
 * navigator(cfg) — owns the chart's time window: zoom stepper, drag-to-pan,
 * view persistence. Ported 1:1 from labchart.js `navigator` (ADR-0010); the
 * page/component still owns its data shaping, axes and y-scale policy via
 * `onApply`.
 */

const DAY = 86400;

export interface ZoomStep {
  label: string;
  days: number;
}

export interface NavigatorConfig {
  /** zoom stops, narrow → wide */
  steps: ZoomStep[];
  /** full data extent in epoch-seconds */
  full: { min: number; max: number };
  /** localStorage key for {stepIdx, center}; omit to disable persistence */
  persistKey?: string;
  zoomIn?: HTMLButtonElement | null;
  zoomOut?: HTMLButtonElement | null;
  label?: HTMLElement | null;
  /** page applies the x-window + its y-axis */
  onApply: (xmin: number, xmax: number, stepIdx: number) => void;
  /** initial zoom stop when nothing is persisted (default: widest) */
  defaultStepIdx?: number;
  /** "end" anchors the newest data at the right edge (default: centered) */
  defaultAnchor?: "end" | "center";
  /** empty room draggable past either data end, as a fraction of the span (default 0.75) */
  overscroll?: number;
}

export interface Navigator {
  stepIdx: number;
  center: number;
  apply: () => void;
  /** re-callable: consumers that recreate their uPlot re-attach to the new .over */
  attachPan: (over: HTMLElement) => void;
}

export function navigator(cfg: NavigatorConfig): Navigator {
  const STEPS = cfg.steps;
  const FULL = cfg.full;
  const KEY = cfg.persistKey;
  const zoomIn = cfg.zoomIn ?? null;
  const zoomOut = cfg.zoomOut ?? null;
  const labelEl = cfg.label ?? null;

  // initial view (used when nothing is persisted yet): default zoom step + anchor.
  const startIdx =
    typeof cfg.defaultStepIdx === "number" ? cfg.defaultStepIdx : STEPS.length - 1;
  const startCenterInit =
    cfg.defaultAnchor === "end"
      ? FULL.max - (STEPS[startIdx]!.days * DAY) / 2 // newest data at the right edge
      : (FULL.min + FULL.max) / 2;

  const nav: Navigator = {
    stepIdx: startIdx,
    center: startCenterInit,
    apply,
    attachPan,
  };

  if (KEY) {
    try {
      const sv = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (sv) {
        if (typeof sv.stepIdx === "number" && sv.stepIdx >= 0 && sv.stepIdx < STEPS.length)
          nav.stepIdx = sv.stepIdx;
        if (typeof sv.center === "number") nav.center = sv.center;
      }
    } catch {
      /* corrupted storage = fall back to defaults */
    }
  }

  const overscroll = typeof cfg.overscroll === "number" ? cfg.overscroll : 0.75;

  function clampCenter(c: number, span: number): number {
    const half = span / 2;
    const lo = FULL.min + half - overscroll * span;
    const hi = FULL.max - half + overscroll * span;
    if (lo > hi) return (FULL.min + FULL.max) / 2;
    return Math.max(lo, Math.min(hi, c));
  }

  function apply(): void {
    const span = STEPS[nav.stepIdx]!.days * DAY;
    nav.center = clampCenter(nav.center, span);
    const xmin = nav.center - span / 2;
    const xmax = nav.center + span / 2;
    if (labelEl) labelEl.textContent = STEPS[nav.stepIdx]!.label;
    if (zoomIn) zoomIn.disabled = nav.stepIdx === 0;
    if (zoomOut) zoomOut.disabled = nav.stepIdx === STEPS.length - 1;
    if (KEY) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ stepIdx: nav.stepIdx, center: nav.center }));
      } catch {
        /* private mode / quota — view just won't persist */
      }
    }
    cfg.onApply(xmin, xmax, nav.stepIdx);
  }

  if (zoomIn)
    zoomIn.addEventListener("click", () => {
      if (nav.stepIdx > 0) {
        nav.stepIdx--;
        apply();
      }
    });
  if (zoomOut)
    zoomOut.addEventListener("click", () => {
      if (nav.stepIdx < STEPS.length - 1) {
        nav.stepIdx++;
        apply();
      }
    });

  // drag-to-pan state shared across attachPan calls, so a mid-drag re-create
  // of the plot doesn't lose the gesture bookkeeping.
  let panning = false;
  let startX = 0;
  let startCenter = 0;

  function attachPan(over: HTMLElement): void {
    over.style.cursor = "default";
    over.addEventListener("pointerdown", (e: PointerEvent) => {
      panning = true;
      startX = e.clientX;
      startCenter = nav.center;
      try {
        over.setPointerCapture(e.pointerId);
      } catch {
        /* environments without pointer capture */
      }
    });
    over.addEventListener("pointermove", (e: PointerEvent) => {
      if (!panning) return;
      const rect = over.getBoundingClientRect();
      nav.center =
        startCenter - ((e.clientX - startX) * (STEPS[nav.stepIdx]!.days * DAY)) / rect.width;
      apply();
    });
    const endPan = (e: PointerEvent) => {
      if (panning) {
        panning = false;
        try {
          over.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }
    };
    over.addEventListener("pointerup", endPan);
    over.addEventListener("pointercancel", endPan);
  }

  return nav;
}
