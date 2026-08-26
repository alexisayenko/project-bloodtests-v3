/**
 * smoothScale(u, scale, init) — eases a y-scale toward its target (~0.5s) so
 * autoscale doesn't jerk. Returns setTarget(min, max); charts route their
 * y-axis changes through this.
 */

/** The slice of a uPlot instance the easer drives. */
export interface ScalePlot {
  setScale(scale: string, limits: { min: number; max: number }): void;
}

export type SetTarget = (min: number, max: number) => void;

export function smoothScale(
  u: ScalePlot,
  scale: string,
  init: { min: number; max: number },
): SetTarget {
  const cur = { min: init.min, max: init.max };
  const tgt = { min: init.min, max: init.max };
  let raf: number | null = null;

  function step(): void {
    const dm = tgt.min - cur.min;
    const dM = tgt.max - cur.max;
    if (Math.abs(dm) < 0.02 && Math.abs(dM) < 0.02) {
      cur.min = tgt.min;
      cur.max = tgt.max;
      u.setScale(scale, { min: cur.min, max: cur.max });
      raf = null;
      return;
    }
    cur.min += dm * 0.15; // exponential ease toward target
    cur.max += dM * 0.15;
    u.setScale(scale, { min: cur.min, max: cur.max });
    raf = requestAnimationFrame(step);
  }

  return function setTarget(min: number, max: number): void {
    tgt.min = min;
    tgt.max = max;
    if (raf == null) raf = requestAnimationFrame(step);
  };
}
