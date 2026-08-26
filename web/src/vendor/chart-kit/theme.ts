/**
 * theme() — shared visual tokens so all charts match each other and the host
 * site. Reads the site's `--muted` custom property for the axis color and the
 * OS dark-mode preference for grid contrast.
 */

import uPlot from "uplot";

export interface Theme {
  dark: boolean;
  axis: string;
  grid: string;
  /** uPlot spline path builder shared by every series */
  spline: ReturnType<NonNullable<typeof uPlot.paths.spline>>;
}

export function theme(root: Element = document.documentElement): Theme {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    dark,
    axis: (getComputedStyle(root).getPropertyValue("--muted") || "#777").trim(),
    grid: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)",
    spline: uPlot.paths.spline!(),
  };
}
