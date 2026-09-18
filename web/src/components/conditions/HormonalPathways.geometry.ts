import { clamp } from '../../utils/math';

/** Hormonal Pathways' pure geometry: the pools donut's arcs and callouts, the zone fit, and every measured pathway line. */

export const DONUT = { size: 80, radius: 34, width: 12, minFreeSweep: 4 } as const;
export const CALLOUT = { lineGap: 12, labelGap: 27, minY: -12, maxY: 92 } as const;

export type Callout = { index: number; x0: number; y0: number; x1: number; y1: number; right: boolean; y: number };

/** Label heights on one side of the ring, pushed apart so no two overlap and kept within the chart's vertical room. */
export function spreadLabels(side: Callout[]): void {
  side.sort((a, b) => a.y - b.y);
  for (let i = 1; i < side.length; i++) side[i].y = Math.max(side[i].y, side[i - 1].y + CALLOUT.labelGap);
  const last = side.length - 1;
  if (last >= 0 && side[last].y > CALLOUT.maxY) {
    side[last].y = CALLOUT.maxY;
    for (let i = last - 1; i >= 0; i--) side[i].y = Math.min(side[i].y, side[i + 1].y - CALLOUT.labelGap);
  }
}

export function poolCallouts(sweeps: readonly number[]): Callout[] {
  const callouts: Callout[] = [];
  let start = 0;
  sweeps.forEach((sweep, index) => {
    const mid = start + sweep / 2;
    start += sweep;
    if (sweep <= 0) return;
    const [x0, y0] = polar(mid, DONUT.radius + DONUT.width / 2 + 1);
    const [x1, y1] = polar(mid, DONUT.radius + DONUT.width / 2 + 9);
    const right = mid % 360 < 180;
    callouts.push({ index, x0, y0, x1, y1, right, y: clamp(y1, CALLOUT.minY, CALLOUT.maxY) });
  });
  spreadLabels(callouts.filter((c) => c.right));
  spreadLabels(callouts.filter((c) => !c.right));
  return callouts;
}

export function polar(angle: number, r: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  const c = DONUT.size / 2;
  return [c + r * Math.sin(rad), c - r * Math.cos(rad)];
}

export function arcPath(from: number, to: number): string {
  const [x0, y0] = polar(from, DONUT.radius);
  const [x1, y1] = polar(to, DONUT.radius);
  return `M${x0},${y0} A${DONUT.radius},${DONUT.radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x1},${y1}`;
}

/** Sweeps in degrees, the free sliver widened to a visible minimum at the expense of the largest bound pool. */
export function poolSweeps(percents: readonly number[]): number[] {
  const sum = percents.reduce((a, b) => a + b, 0);
  const sweeps = percents.map((p) => (p / sum) * 360);
  const deficit = DONUT.minFreeSweep - sweeps[2];
  if (deficit > 0) {
    const largest = sweeps[0] >= sweeps[1] ? 0 : 1;
    sweeps[largest] -= deficit;
    sweeps[2] = DONUT.minFreeSweep;
  }
  return sweeps;
}

export type PathwayShape = 'straight' | 'elbow' | 'drop' | 'fork';

export type PathwayEdge = readonly [from: string, to: string, shape: PathwayShape];

export type CenterX = (rect: DOMRect) => number;

/** A DOM mutation, not a line to draw. */
function positionEnzymes(el: HTMLDivElement, base: DOMRect, centerX: CenterX, zoom: number): void {
  const tNode = el.querySelector('[data-node="t"]');
  const enzymes = el.querySelector<HTMLElement>('.mc-pathway-enzymes');
  if (!tNode || !enzymes) return;
  enzymes.style.transform = '';
  const imgs = [...enzymes.querySelectorAll('.mc-pathway-enzyme .mc-pathway-glyph')].map((i) => i.getBoundingClientRect());
  if (imgs.length !== 2) return;
  const mid = (centerX(imgs[0]) + centerX(imgs[1])) / 2;
  const containerLeft = enzymes.getBoundingClientRect().left - base.left;
  const ar = enzymes.querySelector<HTMLElement>('.mc-pathway-ar');
  if (ar) ar.style.left = `${(mid - containerLeft - ar.getBoundingClientRect().width / 2) / zoom}px`;
  enzymes.style.transform = `translateX(${(centerX(tNode.getBoundingClientRect()) + 8 - mid) / zoom}px)`;
  const er = enzymes.querySelector<HTMLElement>('.mc-pathway-er');
  const e2 = el.querySelector('[data-node="e2"]');
  const e2blood = el.querySelector('[data-node="e2blood"]');
  if (!er || !e2 || !e2blood) return;
  const box = enzymes.getBoundingClientRect();
  const e2Rect = e2.getBoundingClientRect();
  er.style.left = `${(centerX(e2blood.getBoundingClientRect()) + base.left - box.left) / zoom + 48}px`;
  er.style.top = `${(e2Rect.top + e2Rect.height / 2 - box.top - er.getBoundingClientRect().height / 2) / zoom}px`;
}

function positionPituitary(el: HTMLDivElement, centerX: CenterX, zoom: number): void {
  const hp = el.querySelector<HTMLElement>('.mc-pathway-hp');
  const icon = hp?.querySelector('[data-node="pituitary"] .mc-pathway-glyph');
  const tNode = el.querySelector('[data-node="t"]');
  if (!hp || !icon || !tNode) return;
  hp.style.transform = '';
  const axis = centerX(tNode.getBoundingClientRect()) + 8;
  hp.style.transform = `translateX(${(axis - centerX(icon.getBoundingClientRect())) / zoom}px)`;
}

const bandsZoom = (bands: HTMLElement): number => Number(bands.style.getPropertyValue('zoom')) || 1;

/** The natural extent is measured unzoomed-equivalent, so the zoom does not feed back into itself. */
export function fitBands(el: HTMLDivElement, base: DOMRect, centerX: CenterX): void {
  const main = el.querySelector<HTMLElement>('.mc-pathway-main');
  const bands = el.querySelector<HTMLElement>('.mc-pathway-bands');
  if (!main || !bands) return;
  const zoom = bandsZoom(bands);
  positionPituitary(el, centerX, zoom);
  positionEnzymes(el, base, centerX, zoom);
  const left = bands.getBoundingClientRect().left;
  const parts = bands.querySelectorAll('[data-node], .mc-pathway-caption, .mc-pathway-node-label');
  const right = Math.max(left, ...[...parts].map((n) => n.getBoundingClientRect().right));
  const natural = (right - left) / zoom + 8;
  const next = Math.min(1, main.getBoundingClientRect().width / natural);
  if (Math.abs(next - zoom) < 0.002) return;
  if (next === 1) bands.style.removeProperty('zoom');
  else bands.style.setProperty('zoom', next.toFixed(4));
  positionPituitary(el, centerX, bandsZoom(bands));
  positionEnzymes(el, base, centerX, bandsZoom(bands));
}

/** A trunk line from T down to the androgen receptors, with a spur to DHT when it has a reading. */
export function buildExtraLines(el: HTMLDivElement, base: DOMRect, centerX: CenterX): string[] {
  const trunkNode = el.querySelector('[data-node="t"]');
  const arNode = el.querySelector('[data-node="ar"]');
  const dhtNode = el.querySelector('[data-node="dht"]');
  if (!trunkNode || !arNode) return [];
  const x = centerX(trunkNode.getBoundingClientRect()) + 8;
  const arRect = arNode.getBoundingClientRect();
  const firstEnzyme = el.querySelector('[data-node="srd5a"] .mc-pathway-glyph');
  const junction = (firstEnzyme?.getBoundingClientRect().top ?? arRect.top) - base.top - 28;
  const extra = [
    `trunk:${x},${junction} ${x},${arRect.top - base.top - 4}`,
    `${x},${arRect.top - base.top - 12} ${x},${arRect.top - base.top - 4}`,
  ];
  if (!dhtNode) return extra;
  const d = dhtNode.getBoundingClientRect();
  const dBottom = (dhtNode.querySelector('.mc-pathway-caption') ?? dhtNode).getBoundingClientRect().bottom - base.top + 5;
  const midY = arRect.top + arRect.height / 2 - base.top;
  const fromLeft = centerX(d) < centerX(arRect);
  const arEdge = fromLeft ? arRect.left - base.left - 4 : arRect.right - base.left + 4;
  extra.push(`${centerX(d)},${dBottom} ${centerX(d)},${midY} ${arEdge},${midY}`);
  return extra;
}

/** A single fork's trunk-plus-branches line set, from one node down to several target icons. */
export function forkLines(el: HTMLDivElement, base: DOMRect, centerX: CenterX, from: string, targets: readonly string[]): string[] {
  const a = el.querySelector(`[data-node="${from}"]`);
  const icons = targets.map((t) => el.querySelector(`[data-node="${t}"] .mc-pathway-glyph`)).filter((n): n is Element => n !== null);
  if (!a || icons.length === 0) return [];
  const x = centerX(a.getBoundingClientRect()) + 8;
  const y1 = (a.querySelector('.mc-pathway-caption') ?? a).getBoundingClientRect().bottom - base.top + 5;
  const rects = icons.map((i) => i.getBoundingClientRect());
  const junction = Math.min(...rects.map((r) => r.top)) - base.top - 28;
  return [
    `trunk:${x},${y1} ${x},${junction}`,
    ...rects.map((r) => `${x},${junction - 12} ${x},${junction} ${centerX(r)},${junction} ${centerX(r)},${r.top - base.top - 4}`),
  ];
}

/** The 'elbow' shape's line: a horizontal run at the source's mid-height, then down to the target. */
function elbowPathwayLine(a: Element, ra: DOMRect, base: DOMRect, centerX: CenterX, x2: number, y2: number): string[] {
  const midY = ra.top + ra.height / 2 - base.top;
  const inset = a.classList.contains('mc-pathway-slot') ? 18 : -4;
  const x1 = x2 >= centerX(ra) ? ra.right - base.left - inset : ra.left - base.left + inset;
  return [`${x1},${midY} ${x2},${midY} ${x2},${y2}`];
}

/** The 'fork' shape's line: branches off the source's own icon rather than its caption baseline. */
function forkPathwayLine(a: Element, base: DOMRect, centerX: CenterX, x2: number, y2: number): string[] {
  const glyph = (a.querySelector('.mc-pathway-glyph, svg') ?? a).getBoundingClientRect();
  const midY = glyph.top + glyph.height / 2 - base.top;
  const x1 = x2 < centerX(glyph) ? glyph.left - base.left - 4 : glyph.right - base.left + 4;
  return [`${x1},${midY} ${x2},${midY} ${x2},${y2}`];
}

/** The 'drop' shape's line: down from the source, then sideways into the target's mid-height. */
function dropPathwayLine(ra: DOMRect, rb: DOMRect, base: DOMRect, centerX: CenterX, bottomOfA: number): string[] {
  const x = centerX(ra) + 8;
  const midY = rb.top + rb.height / 2 - base.top;
  const edge = x < centerX(rb) ? rb.left - base.left - 4 : rb.right - base.left + 4;
  return [`${x},${bottomOfA} ${x},${midY} ${edge},${midY}`];
}

/** One pathway edge's line, shaped for the geometry the two nodes need. */
function pathwayLine(el: HTMLDivElement, base: DOMRect, centerX: CenterX, from: string, to: string, shape: PathwayShape): string[] {
  const a = el.querySelector(`[data-node="${from}"]`);
  const b = el.querySelector(`[data-node="${to}"]`);
  if (!a || !b) return [];
  const ra = (a.classList.contains('mc-pathway-enzyme') ? (a.querySelector('.mc-pathway-glyph') ?? a) : a).getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  const bottomOf = (node: Element) => (node.querySelector('.mc-pathway-caption') ?? node).getBoundingClientRect().bottom - base.top + 5;
  const down = rb.top >= ra.top;
  const x2 = centerX(rb) - (shape === 'elbow' ? 8 : 0);
  const y2 = down ? rb.top - base.top - 4 : bottomOf(b);
  if (shape === 'elbow') return elbowPathwayLine(a, ra, base, centerX, x2, y2);
  if (shape === 'fork') return forkPathwayLine(a, base, centerX, x2, y2);
  if (shape === 'drop') return dropPathwayLine(ra, rb, base, centerX, bottomOf(a));
  return [`${centerX(ra)},${down ? bottomOf(a) : ra.top - base.top - 4} ${x2},${y2}`];
}

export interface FeedbackMark {
  x: number;
  y: number;
}

/** Estradiol's negative feedback: up from blood E2, then left at the brain's mid-height to its right side, marked "↓" at the head. */
export function feedbackLine(el: HTMLDivElement, base: DOMRect, centerX: CenterX): { lines: string[]; marks: FeedbackMark[] } {
  const e2 = el.querySelector('[data-node="e2blood"] svg');
  const brain = el.querySelector('[data-node="pituitary"] .mc-pathway-glyph');
  if (!e2 || !brain) return { lines: [], marks: [] };
  const from = e2.getBoundingClientRect();
  const to = brain.getBoundingClientRect();
  const lane = to.top + to.height / 2 - base.top;
  const tip = to.right - base.left + 4;
  return {
    lines: [`${centerX(from)},${from.top - base.top - 4} ${centerX(from)},${lane} ${tip},${lane}`],
    marks: [{ x: tip + 10, y: lane - 5 }],
  };
}

export function buildPathwayLines(el: HTMLDivElement, base: DOMRect, centerX: CenterX, pathways: readonly PathwayEdge[]): string[] {
  return pathways.flatMap(([from, to, shape]) => pathwayLine(el, base, centerX, from, to, shape));
}
