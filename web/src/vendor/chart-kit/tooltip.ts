/**
 * tooltip(u, render, dateFmt) — the floating `.u-tip` shell. The harness owns
 * placement/show/hide; the page owns the row content via `render` — that split
 * is what keeps chart-kit domain-agnostic.
 */

import { isoDate } from "./dates";

/** The slice of a uPlot instance the tooltip touches (structural, so fakes test cheaply). */
export interface TooltipPlot {
  over: HTMLElement;
  data: ArrayLike<ArrayLike<number>>;
  cursor: { idx?: number | null; left?: number; top?: number };
}

export type TooltipRender = (idx: number, self: TooltipPlot) => string | null | undefined | false;

export function tooltip(
  u: TooltipPlot,
  render: TooltipRender,
  dateFmt?: (sec: number) => string,
): (self: TooltipPlot) => void {
  const fmt = dateFmt || isoDate;
  const tip = document.createElement("div");
  tip.className = "u-tip";
  tip.style.display = "none";
  u.over.appendChild(tip);
  return function setCursor(self: TooltipPlot): void {
    const idx = self.cursor.idx;
    if (idx == null || (self.cursor.left ?? -1) < 0) {
      tip.style.display = "none";
      return;
    }
    const html = render(idx, self);
    if (!html) {
      tip.style.display = "none";
      return;
    }
    tip.innerHTML =
      '<div class="u-tip-date">' + fmt(self.data[0]![idx]!) + "</div>" + html;
    tip.style.display = "block";
    tip.style.transform =
      "translate(" + ((self.cursor.left ?? 0) + 14) + "px," + ((self.cursor.top ?? 0) + 14) + "px)";
  };
}
