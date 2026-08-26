/**
 * eventBands(cfg) — a uPlot `drawClear` hook that shades labeled time periods
 * (medication courses, diet phases, interventions …) across the plot. The
 * harness owns the drawing math; the page owns the event list and the toggle
 * UI — same shell/content split as the tooltip.
 *
 * Open-ended periods (`end: null`) extend to the right edge of the *visible*
 * window, so an ongoing course keeps following the chart as the user pans.
 */

export interface EventPeriod {
  start: string;
  end: string | null;
  /** per-period label (e.g. dose); falls back to the event label */
  label?: string;
}

export interface EventBand {
  id: string;
  label: string;
  /** band fill */
  color: string;
  /** label text color, light / dark scheme */
  text: string;
  textDark?: string;
  periods: EventPeriod[];
}

/** The slice of a uPlot instance the band painter touches. */
export interface EventPlot {
  ctx: CanvasRenderingContext2D;
  bbox: { left: number; top: number; width: number; height: number };
  valToPos(val: number, scale: string, canvasPixels?: boolean): number;
  scales: { [key: string]: { min?: number | null; max?: number | null } };
}

export interface EventBandsConfig {
  events: EventBand[];
  /** which event ids are currently shown — read at every draw, so a toggle only needs a redraw */
  active: () => string[];
  dark?: boolean;
  /** label font family; defaults to the page body's */
  fontFamily?: string;
}

function ts(s: string): number {
  return Date.parse(s) / 1000;
}

export function eventBands(cfg: EventBandsConfig): (u: EventPlot) => void {
  return function draw(u: EventPlot): void {
    const on = cfg.active();
    if (!on.length) return;
    const ctx = u.ctx;
    const bb = u.bbox;
    const dpr = Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    const family =
      cfg.fontFamily ??
      (typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif");
    ctx.save();
    ctx.beginPath();
    ctx.rect(bb.left, bb.top, bb.width, bb.height);
    ctx.clip();
    ctx.font = 10 * dpr + "px " + family;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const ev of cfg.events) {
      if (!on.includes(ev.id)) continue;
      for (const p of ev.periods) {
        const x0 = u.valToPos(ts(p.start), "x", true);
        const x1 = u.valToPos(p.end ? ts(p.end) : (u.scales["x"]?.max ?? 0), "x", true);
        if (x1 < bb.left || x0 > bb.left + bb.width) continue;
        const lx = Math.max(x0, bb.left);
        const rx = Math.min(x1, bb.left + bb.width);
        ctx.fillStyle = ev.color;
        ctx.fillRect(lx, bb.top, rx - lx, bb.height);
        ctx.fillStyle = cfg.dark ? (ev.textDark ?? ev.text) : ev.text;
        ctx.fillText(" " + (p.label || ev.label), lx, bb.top + 2 * dpr);
      }
    }
    ctx.restore();
  };
}
