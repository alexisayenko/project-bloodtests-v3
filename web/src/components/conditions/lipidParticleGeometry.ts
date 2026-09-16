export interface Point {
  x: number;
  y: number;
}

/** A deterministic 0..1 phase per particle id, so each outline wobbles its own way and never changes between renders. */
function phaseOf(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h / 9973;
}

/** A slightly organic closed outline: a circle of radius `r` perturbed by two low harmonics. */
export function blobPolygon(cx: number, cy: number, r: number, seed: string, steps = 96): Point[] {
  const phase = phaseOf(seed) * 2 * Math.PI;
  const points: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const k = 1 + 0.018 * Math.sin(3 * t + phase) + 0.012 * Math.sin(5 * t + 2 * phase) + 0.01 * Math.sin(2 * t + 3 * phase);
    points.push({ x: cx + r * k * Math.cos(t), y: cy + r * k * Math.sin(t) });
  }
  return points;
}

export function polygonPath(points: readonly Point[]): string {
  return `${points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')} Z`;
}

export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Top and bottom of a star-shaped outline along the vertical line `x`, or undefined outside it. */
export function verticalSpan(points: readonly Point[], x: number): { top: number; bottom: number } | undefined {
  const ys: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a.x <= x !== b.x <= x) ys.push(a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x));
  }
  return ys.length >= 2 ? { top: Math.min(...ys), bottom: Math.max(...ys) } : undefined;
}

export interface RegionOptions {
  /** Clear space kept between neighbouring regions and between a region and the outline. */
  gap: number;
  /** Height of the wave each cut follows, so a boundary reads as organic rather than ruled. */
  amplitude: number;
  seed: string;
  step?: number;
}

/**
 * Stacked regions inside `outline`, top to bottom, the k-th holding
 * `fractions[k]` of the outline's whole area. Each boundary is a gentle wave
 * whose level is solved for, column by column, so the areas are data, not art.
 */
export function organicRegions(outline: readonly Point[], fractions: readonly number[], options: RegionOptions): Point[][] {
  const { gap, amplitude, seed, step = 2 } = options;
  const xs = outline.map((p) => p.x);
  const left = Math.min(...xs);
  const width = Math.max(...xs) - left;
  const columns: { x: number; top: number; bottom: number }[] = [];
  for (let x = left + step / 2; x < left + width; x += step) {
    const span = verticalSpan(outline, x);
    if (span && span.bottom - span.top > 2 * gap) columns.push({ x, top: span.top + gap, bottom: span.bottom - gap });
  }
  const total = polygonArea(outline);
  const phase = (k: number) => ((seed.length * 1.7 + k * 2.3) % 6.28);
  const wave = (k: number, x: number) => amplitude * Math.sin((Math.PI * 1.3 * (x - left)) / width + phase(k));

  const bounds = (above: ((x: number) => number) | undefined, level: number, k: number) =>
    columns.map((c) => ({
      x: c.x,
      upper: Math.max(c.top, above ? above(c.x) + gap / 2 : c.top),
      lower: Math.min(c.bottom, level + wave(k, c.x) - gap / 2),
    }));
  const areaOf = (spans: ReturnType<typeof bounds>) => spans.reduce((sum, s) => sum + Math.max(0, s.lower - s.upper) * step, 0);

  const ys = outline.map((p) => p.y);
  const regions: Point[][] = [];
  let above: ((x: number) => number) | undefined;
  for (let k = 0; k < fractions.length; k++) {
    let lo = Math.min(...ys) - amplitude;
    let hi = Math.max(...ys) + amplitude + gap;
    const target = fractions[k] * total;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (areaOf(bounds(above, mid, k)) < target) lo = mid;
      else hi = mid;
    }
    const level = (lo + hi) / 2;
    const spans = bounds(above, level, k).filter((s) => s.lower > s.upper);
    regions.push([...spans.map((s) => ({ x: s.x, y: s.upper })), ...spans.reverse().map((s) => ({ x: s.x, y: s.lower }))]);
    const kk = k;
    above = (x: number) => level + wave(kk, x);
  }
  return regions;
}

/** Outline diameter in px by particle: diameter order in fixed steps, never to scale. */
export const GLYPH_SIZE: Readonly<Record<string, number>> = { chylomicron: 170, vldl: 142, idl: 118, ldl: 100, lpa: 100, hdl: 72 };
