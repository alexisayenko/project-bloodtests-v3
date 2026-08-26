/**
 * The shared time axis: tick labels adapt to the visible span
 * (year / year-month / month / month-day).
 */

import { MON } from "./dates";
import type { Theme } from "./theme";

const DAY = 86400;

/**
 * The slice of a uPlot instance the axis formatter reads — kept a structural
 * supertype of `uPlot` so the function satisfies uPlot's `Axis.Values` type.
 */
interface AxisPlot {
  scales: { [key: string]: { min?: number | null; max?: number | null } };
}

export function xAxisValues(self: AxisPlot, splits: number[]): string[] {
  const sc = self.scales["x"];
  const days = ((sc?.max ?? 0) - (sc?.min ?? 0)) / DAY;
  return splits.map((s) => {
    const d = new Date(s * 1000);
    const Y = d.getUTCFullYear();
    const M = ("0" + (d.getUTCMonth() + 1)).slice(-2);
    const D = ("0" + d.getUTCDate()).slice(-2);
    if (days >= 2920) return "" + Y; // ≥ ~8y
    if (days >= 600) return Y + "-" + M; // ≥ ~1.6y
    if (days >= 300) return MON[d.getUTCMonth()]!; // ≥ ~10mo
    return M + "-" + D;
  });
}

/** xAxis(theme) — a uPlot axis config for the shared time axis. */
export function xAxis(th: Theme): {
  stroke: string;
  grid: { stroke: string; width: number };
  ticks: { stroke: string };
  values: typeof xAxisValues;
} {
  return {
    stroke: th.axis,
    grid: { stroke: th.grid, width: 0.5 },
    ticks: { stroke: th.grid },
    values: xAxisValues,
  };
}
