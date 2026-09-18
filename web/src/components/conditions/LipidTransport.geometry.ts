/** Lipid Transport's pure geometry: every arrow, bond and outline, computed from measured rects. */

export type Point = { x: number; y: number };

export interface Arrow {
  id: string;
  d: string;
}

export interface Outline {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rectCenter = (r: DOMRect, base: DOMRect): Point => ({ x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top });

/** A point `radius` px along the line from `from` to `to`, so a bond meets a circle radially. */
export const onEdge = (from: Point, to: Point, radius: number): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  return { x: from.x + (dx / dist) * radius, y: from.y + (dy / dist) * radius };
};

/** A straight arrow between two rects' centers, each end pulled back to its rect's edge; null when either rect is missing. */
export function edgeToEdgeArrow(
  from: DOMRect | undefined,
  to: DOMRect | undefined,
  base: DOMRect,
  fromExtra = 3,
  toExtra = 5,
  dim: 'width' | 'height' = 'width'
): string | null {
  if (!from || !to) return null;
  const r = rectCenter(from, base);
  const s = rectCenter(to, base);
  const fromRadius = (dim === 'width' ? from.width : from.height) / 2 + fromExtra;
  const toRadius = (dim === 'width' ? to.width : to.height) / 2 + toExtra;
  const start = onEdge(r, s, fromRadius);
  const end = onEdge(s, r, toRadius);
  return `M${start.x},${start.y} L${end.x},${end.y}`;
}

export function ldlUptakeArrow(ldl: DOMRect | undefined, targetCells: DOMRect | undefined, ldlApo: DOMRect | undefined, base: DOMRect): string | null {
  if (!ldl || !targetCells || !ldlApo) return null;
  const x = ldlApo.left + ldlApo.width / 2 - base.left;
  const y0 = ldl.bottom - base.top;
  const y1 = targetCells.top + targetCells.height / 2 - base.top;
  const x1 = targetCells.left - base.left;
  return `M${x},${y0} L${x},${y1} L${x1},${y1}`;
}

/** Each hop runs through the gap at the holder apoprotein's height, so it never crosses a TRIG/Chol circle. */
export function chainHopArrows(
  vldl: DOMRect | undefined,
  idl: DOMRect | undefined,
  ldl: DOMRect | undefined,
  vldlApo: DOMRect | undefined,
  idlApo: DOMRect | undefined,
  base: DOMRect
): Arrow[] {
  const chain: Arrow[] = [];
  if (vldl && idl && vldlApo) {
    const y = vldlApo.top + vldlApo.height / 2 - base.top;
    chain.push({ id: 'vldl-idl', d: `M${vldl.right - base.left},${y} L${idl.left - base.left},${y}` });
  }
  if (idl && ldl && idlApo) {
    const y = idlApo.top + idlApo.height / 2 - base.top;
    chain.push({ id: 'idl-ldl', d: `M${idl.right - base.left},${y} L${ldl.left - base.left},${y}` });
  }
  return chain;
}

/** Never from VLDL, which the diagram omits per RETENTION_SOURCES' size ceiling. */
export function computeRetentionArrows(
  idlApo: DOMRect | undefined,
  ldlApo: DOMRect | undefined,
  lpaApo: DOMRect | undefined,
  arteryGap: DOMRect | undefined,
  base: DOMRect
): Arrow[] {
  if (!arteryGap) return [];
  const apos: readonly (readonly [string, DOMRect | undefined])[] = [
    ['idl', idlApo],
    ['ldl', ldlApo],
    ['lpa', lpaApo],
  ];
  return apos.flatMap(([id, apo]) => {
    const d = edgeToEdgeArrow(apo, arteryGap, base, 3, 3);
    return d ? [{ id, d }] : [];
  });
}

export function lplArrowPath(
  vldl: DOMRect | undefined,
  lplBubble: DOMRect | undefined,
  fattyAcids: DOMRect | undefined,
  lplMuscle: DOMRect | undefined,
  lplAdipocytes: DOMRect | undefined,
  base: DOMRect
): string | null {
  if (!vldl || !lplBubble || !fattyAcids) return null;
  const segments = [
    `M${vldl.left - base.left + 20},${vldl.bottom - base.top + 2} L${lplBubble.left + lplBubble.width / 2 - base.left},${lplBubble.top - base.top - 4}`,
    `M${lplBubble.left + lplBubble.width / 2 - base.left},${lplBubble.bottom - base.top + 2} L${fattyAcids.left + fattyAcids.width / 2 - base.left},${fattyAcids.top - base.top - 2}`,
  ];
  const toMuscle = edgeToEdgeArrow(fattyAcids, lplMuscle, base);
  if (toMuscle) segments.push(toMuscle);
  const toAdipocytes = edgeToEdgeArrow(fattyAcids, lplAdipocytes, base);
  if (toAdipocytes) segments.push(toAdipocytes);
  return segments.join(' ');
}

export function particleBondsAndOutlines(el: Element, base: DOMRect): { bonds: Arrow[]; outlines: Outline[] } {
  const bonds: Arrow[] = [];
  const outlines: Outline[] = [];
  for (const id of ['vldl', 'idl', 'ldl', 'chylomicron', 'hdl', 'lpa', 'vldl-construction']) {
    const trig = el.querySelector(`[data-node="${id}-trig"]`)?.getBoundingClientRect();
    const apo = el.querySelector(`[data-node="${id}-apo"]`)?.getBoundingClientRect();
    const chol = el.querySelector(`[data-node="${id}-chol"]`)?.getBoundingClientRect();
    if (!trig || !apo || !chol) continue;
    const a = rectCenter(apo, base);
    const c = rectCenter(chol, base);
    const t = rectCenter(trig, base);
    const apoRadius = apo.width / 2 + 3;
    const cholEdge = onEdge(c, a, chol.width / 2 + 2);
    const apoFromC = onEdge(a, c, apoRadius);
    const trigEdge = onEdge(t, a, trig.width / 2 + 2);
    const apoFromT = onEdge(a, t, apoRadius);
    const bond = `M${cholEdge.x},${cholEdge.y} L${apoFromC.x},${apoFromC.y} M${trigEdge.x},${trigEdge.y} L${apoFromT.x},${apoFromT.y}`;
    // The ApoB caption is wider than its icon, so the box must include it.
    const apoCaption = el.querySelector(`[data-node="${id}-apo"]`)?.closest('.mc-pathway-anchor')?.querySelector('.mc-pathway-caption')?.getBoundingClientRect();
    const left = Math.min(chol.left, apo.left, trig.left, apoCaption?.left ?? Infinity) - base.left;
    const right = Math.max(chol.right, apo.right, apoCaption?.right ?? -Infinity) - base.left;
    const top = Math.min(chol.top, apo.top, trig.top) - base.top;
    bonds.push({ id, d: bond });
    const pad = 10;
    outlines.push({ id, x: left - pad, y: top - pad, w: right - left + pad * 2, h: apo.bottom - base.top + 26 - (top - pad) });
  }
  return { bonds, outlines };
}

/** Lands on the liver itself, not liver-trig: the liver takes fatty acids up, then hands them to its own TRIG synthesis. */
export function faSupplyArrowPath(faSupply: DOMRect | undefined, liverOrgan: DOMRect | undefined, base: DOMRect): string | null {
  if (!faSupply || !liverOrgan) return null;
  const x = faSupply.left + faSupply.width / 2 - base.left;
  const fromY = faSupply.top - base.top - 3;
  const toY = liverOrgan.bottom - base.top + 5;
  return `M${x},${fromY} L${x},${toY}`;
}

/** Starts from the liver's bottom edge, not its center, which would land beside HMG-CoA reductase and imply the enzyme makes TRIG. */
export function liverToTrigArrowPath(liverOrgan: DOMRect | undefined, liverTrig: DOMRect | undefined, base: DOMRect): string | null {
  if (!liverOrgan || !liverTrig) return null;
  const from = { x: liverOrgan.left + liverOrgan.width / 2 - base.left, y: liverOrgan.bottom - base.top - 3 };
  const s = rectCenter(liverTrig, base);
  const to = onEdge(s, from, liverTrig.width / 2 + 5);
  return `M${from.x},${from.y} L${to.x},${to.y}`;
}

export function liverToApobArrowPath(liverOrgan: DOMRect | undefined, liverApob: DOMRect | undefined, base: DOMRect): string | null {
  if (!liverOrgan || !liverApob) return null;
  const x = liverApob.left + liverApob.width / 2 - base.left;
  const fromY = liverOrgan.bottom - base.top - 3;
  const toY = liverApob.top - base.top + 5;
  return `M${x},${fromY} L${x},${toY}`;
}

/** A region with no sourced area in Data mode is not drawn, so its particle's outline is ringed instead. */
export function presentTargets(el: Element, targets: readonly string[]): string[] {
  return [...new Set(targets.map((t) => (el.querySelector(`[data-node="${t}"]`) ? t : t.split('-')[0])))];
}
