import { useEffect, useRef, useState, type RefObject } from 'react';
import { ALIAS_TO_PRIMARY, ALSO_REFS } from '../../data/analyteCatalog';
import { fmtNum } from '../../utils/format';
import type { IndexBands, IndexDef } from '../../data/computedIndices';

/** The pieces the pathway pages share: measures, chips' values, reference and source blocks, the date stepper. */

export const DASH = '–';

export type Status = 'ok' | 'warn' | 'bad' | 'none';

export interface LabRange {
  low?: number;
  high?: number;
  unit: string;
}

export interface Measure {
  text: string;
  status: Status;
  /** The unit the value is shown in, when there is a reading. */
  unit?: string;
  /** The lab-printed range, in the same unit as the shown value. */
  lab?: LabRange;
  /** A testosterone fraction's share of total testosterone, in molar terms. */
  share?: string;
  /** The same share as a number, for the pools donut. */
  sharePercent?: number;
}

export const EMPTY: Measure = { text: DASH, status: 'none' };

export function withVariants(loinc: string): string[] {
  const primary = ALIAS_TO_PRIMARY[loinc] ?? loinc;
  return [...new Set([loinc, primary, ...(ALSO_REFS[primary] ?? []).map((ref) => ref.loinc)])];
}

export const valueText = (measure: Measure) => (measure.share ? `${measure.text} · ${measure.share}` : measure.text);

export interface CitedSource {
  organization: string;
  title: string;
  url?: string;
  year?: number;
  retrieved?: string;
  /** The source's own words, when the claim citing it quotes them. */
  quote?: string;
}

export interface ReferenceLine {
  label?: string;
  text: string;
  cites: number[];
}

export interface ReferenceInfo {
  tag?: string;
  headCites: number[];
  lines: ReferenceLine[];
  empty?: string;
  sources: CitedSource[];
}

export const NO_REFERENCE: ReferenceInfo = { headCites: [], lines: [], empty: 'No reference range', sources: [] };

export function formatBounds(low: number | undefined, high: number | undefined, unit: string | undefined, inclusive: boolean): string {
  const u = unit ? ` ${unit}` : '';
  if (low != null && high != null) return `${fmtNum(low)} – ${fmtNum(high)}${u}`;
  if (low != null) return `${inclusive ? '≥' : '>'} ${fmtNum(low)}${u}`;
  if (high != null) return `${inclusive ? '≤' : '<'} ${fmtNum(high)}${u}`;
  return DASH;
}

/** The lab-printed range as a reference block. */
export function labReference({ low, high, unit }: LabRange): ReferenceInfo {
  return { tag: 'lab', headCites: [], lines: [{ text: formatBounds(low, high, unit, false), cites: [] }], sources: [] };
}

export const CARD_WIDTH = 300;

/** Closes whatever is open on Escape or on a pointer-down outside `keep`, and re-runs `onResize` while open. */
export function useDismiss(open: string | null, close: () => void, keep: string, onResize?: () => void): void {
  useEffect(() => {
    if (open === null) return;
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(keep)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    if (onResize) window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      if (onResize) window.removeEventListener('resize', onResize);
    };
  }, [open, close, keep, onResize]);
}

/** An index's three zones as a reference block, each cut placed in the unit its value is shown in, cited from INDEX_DEFS. */
export function zoneReference(def: IndexDef, bands: IndexBands | null, place: (cut: number) => { value: number; unit: string }): ReferenceInfo {
  if (!bands) return NO_REFERENCE;
  const shown = bands.cut.map(place);
  const u = shown[0].unit ? ` ${shown[0].unit}` : '';
  const [good, warn] = shown.map((c) => fmtNum(c.value));
  const zones: [string, string][] = bands.hi
    ? [['Within range', `≥ ${good}${u}`], ['Borderline', `${warn} – ${good}${u}`], ['Low', `< ${warn}${u}`]]
    : [['Within range', `< ${good}${u}`], ['Borderline', `${good} – ${warn}${u}`], ['High', `≥ ${warn}${u}`]];
  const sources = def.references.map((r) => ({ organization: r.organization, title: r.document, url: r.url, year: r.year, retrieved: r.retrieved }));
  return {
    tag: 'guide',
    headCites: sources.map((_, i) => i + 1),
    lines: zones.map(([label, text]) => ({ label, text, cites: [] })),
    sources,
  };
}

/** Renumbers each block's citations into one deduplicated source list, in order of first appearance. */
export function mergeReferences(infos: readonly ReferenceInfo[]): { infos: ReferenceInfo[]; sources: CitedSource[] } {
  const keys: string[] = [];
  const sources: CitedSource[] = [];
  const merged = infos.map((info) => {
    const map = info.sources.map((s) => {
      const key = `${s.title}|${s.url ?? ''}`;
      if (!keys.includes(key)) {
        keys.push(key);
        sources.push(s);
      }
      return keys.indexOf(key) + 1;
    });
    const to = (n: number) => map[n - 1];
    return { ...info, headCites: info.headCites.map(to), lines: info.lines.map((l) => ({ ...l, cites: l.cites.map(to) })), sources: [] };
  });
  return { infos: merged, sources };
}

/** Keeps only the listed sources and renumbers every tag into that list, dropping tags whose source was cut. */
export function keepSources(infos: readonly ReferenceInfo[], sources: readonly CitedSource[], titles: readonly string[]): { infos: ReferenceInfo[]; sources: CitedSource[] } {
  const kept: CitedSource[] = [];
  const renumber = new Map<number, number>();
  for (const title of titles) {
    const matches = sources.flatMap((s, i) => (s.title.includes(title) ? [i + 1] : []));
    if (matches.length === 0) continue;
    kept.push(sources[matches[0] - 1]);
    for (const n of matches) renumber.set(n, kept.length);
  }
  const to = (cites: readonly number[]) => [...new Set(cites.flatMap((n) => (renumber.has(n) ? [renumber.get(n)!] : [])))];
  return {
    infos: infos.map((info) => ({ ...info, headCites: to(info.headCites), lines: info.lines.map((l) => ({ ...l, cites: to(l.cites) })) })),
    sources: kept,
  };
}

/**
 * Several calculated estimates of one quantity as one reference block: the
 * zones once when every method shares them, otherwise each method's own,
 * labelled by method.
 */
export function combinedZones(calculated: readonly ReferenceInfo[], methods: readonly string[]): ReferenceInfo {
  const [first, ...rest] = calculated;
  const sameZones =
    first.lines.length > 0 &&
    rest.every((info) => info.lines.length === first.lines.length && info.lines.every((l, i) => l.label === first.lines[i].label && l.text === first.lines[i].text));
  return {
    tag: calculated.find((i) => i.tag)?.tag,
    headCites: [...new Set(calculated.flatMap((i) => i.headCites))].sort((a, b) => a - b),
    lines: sameZones
      ? first.lines.map((l, i) => ({ ...l, cites: [...new Set(calculated.flatMap((info) => info.lines[i].cites))] }))
      : calculated.flatMap((info, i) => {
          if (info.lines.length === 0) return [{ label: methods[i], text: info.empty ?? DASH, cites: [] }];
          return info.lines.map((l) => ({ ...l, label: `${methods[i]} · ${l.label ?? ''}` }));
        }),
    sources: [],
  };
}

export function roundedPath(points: string, radius = 10): string {
  const pts = points.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ax = cx - ((cx - px) / inLen) * r;
    const ay = cy - ((cy - py) / inLen) * r;
    const bx = cx + ((nx - cx) / outLen) * r;
    const by = cy + ((ny - cy) / outLen) * r;
    d += ` L${ax},${ay} Q${cx},${cy} ${bx},${by}`;
  }
  const last = pts.at(-1) ?? pts[0];
  return `${d} L${last[0]},${last[1]}`;
}

export interface Ring {
  cx: number;
  cy: number;
  r: number;
}

export interface Association {
  badge: string;
  paths: string[];
  rings: Ring[];
}

/** The rings drawn around an association's target nodes. */
export function ringsFor(el: HTMLElement, base: DOMRect, targets: readonly string[]): Ring[] {
  return targets.flatMap((target) => {
    const node = el.querySelector(`[data-node="${target}"]`);
    if (!node) return [];
    const r = (node.querySelector('.mc-pathway-glyph, svg, .mc-pathway-bubble') ?? node).getBoundingClientRect();
    return [{ cx: r.left + r.width / 2 - base.left, cy: r.top + r.height / 2 - base.top, r: Math.max(r.width, r.height) / 2 + 6 }];
  });
}

/** One badge's association bus-plus-rings, or none while its targets aren't on screen. */
export function associationFor(el: HTMLElement, base: DOMRect, badge: string, targets: readonly string[]): Association[] {
  const badgeEl = el.querySelector(`[data-badge="${badge}"]`);
  if (!badgeEl) return [];
  const br = badgeEl.getBoundingClientRect();
  const bx = br.left - base.left;
  const by = br.top + 20 - base.top;
  const rings = ringsFor(el, base, targets);
  if (rings.length === 0) return [];
  const lane = Math.min(...rings.map((g) => g.cy - g.r)) - 16;
  const rightmost = Math.max(...rings.map((g) => g.cx));
  const leftmost = Math.min(...rings.map((g) => g.cx));
  const turn = Math.max(rightmost + 24, bx - 24);
  const paths = [
    roundedPath(`${bx},${by} ${turn},${by} ${turn},${lane} ${leftmost},${lane}`, 12),
    ...rings.map((g) => `M${g.cx},${lane} L${g.cx},${g.cy - g.r}`),
  ];
  return [{ badge, paths, rings }];
}

/**
 * Runs `measure` on the root once laid out and again whenever the root or any
 * `[data-node]` inside it resizes, an image inside it loads, or fonts settle --
 * one animation frame at most per burst.
 */
/** Dispatched on a `useMeasuredLayout` root to force its next-frame recompute outside the triggers it watches on its own -- e.g. a debug drag's `transform`, which fires no ResizeObserver. */
export const MC_NUDGE_EVENT = 'mc-pathway-nudge';

export function useMeasuredLayout(root: RefObject<HTMLDivElement | null>, layoutKey: string, measure: (el: HTMLDivElement) => void): void {
  const latest = useRef(measure);
  useEffect(() => {
    latest.current = measure;
  });
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    let disposed = false;
    const observer = new ResizeObserver(() => schedule());
    const observeNodes = () => el.querySelectorAll('[data-node]').forEach((node) => observer.observe(node));
    const schedule = () => {
      if (frame || disposed) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        observeNodes();
        latest.current(el);
      });
    };
    const onLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement) schedule();
    };
    const onNudge = () => schedule();
    observer.observe(el);
    observeNodes();
    el.addEventListener('load', onLoad, true);
    el.addEventListener(MC_NUDGE_EVENT, onNudge);
    if ('fonts' in document) document.fonts.ready.then(schedule, () => undefined);
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      el.removeEventListener('load', onLoad, true);
      el.removeEventListener(MC_NUDGE_EVENT, onNudge);
      observer.disconnect();
    };
  }, [root, layoutKey]);
}

/** One dragged node's accumulated offset, plus a one-time snapshot of whichever positioning fields are actually set (inline if set, else computed), taken at drag start. */
export interface NodeDragState {
  dx: number;
  dy: number;
  left: string;
  top: string;
  marginLeft: string;
  marginTop: string;
}

function styleSnapshot(el: HTMLElement): Pick<NodeDragState, 'left' | 'top' | 'marginLeft' | 'marginTop'> {
  const cs = getComputedStyle(el);
  const field = (inline: string, computed: string) => (inline ? `${inline} (inline)` : `${computed} (computed)`);
  return {
    left: field(el.style.left, cs.left),
    top: field(el.style.top, cs.top),
    marginLeft: field(el.style.marginLeft, cs.marginLeft),
    marginTop: field(el.style.marginTop, cs.marginTop),
  };
}

/**
 * DEV-ONLY drag debugging (temporary, session-only tool -- no persistence):
 * while `enabled`, every `[data-node]` element inside `root` becomes
 * mouse-draggable. Dragging applies a purely visual `transform:
 * translate(dx, dy)` to the element -- it never touches `left`/`top`/margin,
 * so a reload always resets it -- and dispatches `MC_NUDGE_EVENT` on `root`
 * each frame so a `useMeasuredLayout` consumer (e.g. the arrow overlay)
 * re-measures and tracks the node in real time, since a bare `transform`
 * fires no ResizeObserver on its own. Each node's accumulated (dx, dy) is
 * kept across repeated drags within the session, logged to the console on
 * mouseup, and returned for an on-page readout; `reset()` clears every
 * transform and the accumulated state, used when Debug mode is turned off.
 */
export function useNodeDrag(root: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [drags, setDrags] = useState<Record<string, NodeDragState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragsRef = useRef(drags);
  useEffect(() => {
    dragsRef.current = drags;
  }, [drags]);

  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return;
    let frame = 0;
    let current: {
      id: string;
      el: HTMLElement;
      startX: number;
      startY: number;
      baseDx: number;
      baseDy: number;
      snapshot: Pick<NodeDragState, 'left' | 'top' | 'marginLeft' | 'marginTop'>;
    } | null = null;

    const onMouseMove = (e: MouseEvent) => {
      if (!current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!current) return;
        const dx = Math.round(current.baseDx + (e.clientX - current.startX));
        const dy = Math.round(current.baseDy + (e.clientY - current.startY));
        current.el.style.transform = `translate(${dx}px, ${dy}px)`;
        setDrags((prev) => ({ ...prev, [current!.id]: { ...current!.snapshot, dx, dy } }));
        el.dispatchEvent(new CustomEvent(MC_NUDGE_EVENT));
      });
    };
    const onMouseUp = () => {
      if (current) {
        const id = current.id;
        const d = dragsRef.current[id];
        if (d) console.log(`[debug] ${id}: dx=${d.dx >= 0 ? '+' : ''}${d.dx} dy=${d.dy >= 0 ? '+' : ''}${d.dy}`);
      }
      current = null;
      setActiveId(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-node]') : null;
      if (!target) return;
      e.preventDefault();
      const id = target.dataset.node!;
      const prior = dragsRef.current[id];
      current = { id, el: target, startX: e.clientX, startY: e.clientY, baseDx: prior?.dx ?? 0, baseDy: prior?.dy ?? 0, snapshot: styleSnapshot(target) };
      setActiveId(id);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('mousedown', onMouseDown);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      cancelAnimationFrame(frame);
    };
  }, [root, enabled]);

  const reset = () => {
    root.current?.querySelectorAll<HTMLElement>('[data-node]').forEach((node) => {
      node.style.transform = '';
    });
    setDrags({});
    setActiveId(null);
  };

  return { drags, activeId, reset };
}

/** Glyph sizes encode level of organisation — molecular actor < cell < organ — each the drawn size, whatever padding the artwork carries. */
export const SIZE = { molecular: 32, cell: 64, organ: 128 } as const;

/** A raster glyph, its drawn content's bounding box in the file's own pixels, and the size that content is shown at. */
export interface GlyphArt {
  src: string;
  width: number;
  height: number;
  box: readonly [left: number, top: number, right: number, bottom: number];
  size: number;
}

export const ENZYME_ART: GlyphArt = { src: '/pathways/enzyme-icon.png?v=2', width: 96, height: 96, box: [12, 12, 84, 83], size: SIZE.molecular };

/** Triglyceride glyph, cropped to its non-transparent bounding box. `size` is overridden per call site, since Glyph bakes its render size into the art object. Lives here (rather than Particle3.tsx, a components-only file) since react-refresh requires a file to export only components; LipidTransportView's own standalone TRIG glyphs (the liver's and enterocytes' own triglyceride synthesis, which sit outside any particle) import it from here too. */
export const TRIGLYCERIDE_ART: GlyphArt = { src: '/pathways/triglyceride.png?v=1', width: 675, height: 449, box: [6, 6, 669, 443], size: SIZE.molecular };

/**
 * particle1: the simplest reusable pathway node config -- a single bare
 * glyph with a caption, for a molecular-scale actor. Covers every kind of
 * bare, no-tile node currently hand-coded across both pathway pages: an
 * enzyme (HMG-CoA reductase, LPL, aromatase, 5α-reductase), a carrier
 * (SHBG, Albumin), a signal (T, DHT, E2), a receptor (androgen/estrogen),
 * or a standalone byproduct with no carrier of its own (LPL's released
 * fatty acids). particle2/particle3 (docked-compound and multi-compound
 * lipoprotein nodes) are out of scope here -- see `ParticleNode` in
 * `Particle3.tsx` for the latter.
 */
export interface Particle1 {
  /** Caption text, e.g. "HMG-CoA reductase". */
  name: string;
  type: 'enzyme' | 'carrier' | 'signal' | 'receptor' | 'byproduct';
  /** White circular backdrop for contrast when the node sits on top of busy illustrative artwork (e.g. HMG-CoA reductase on the liver image). Omit/false for a node on plain background. */
  backdrop?: boolean;
}
