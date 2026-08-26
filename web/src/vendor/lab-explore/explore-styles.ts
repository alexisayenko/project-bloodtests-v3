/**
 * Shadow-DOM styles for <lab-explore>. Ported from the homepage's explore CSS
 * (style.css "Explore: overlay chart + marker picker" + chart-toolbar/zoom/
 * u-tip blocks) with the same :host custom-property indirection pattern as
 * lab-matrix: host pages theme via --fg/--bg/--muted/--rule/--rule-soft/
 * --accent, with standalone fallbacks. uPlot's core CSS is inlined because
 * outer stylesheets can't pierce the shadow root.
 */

export const UPLOT_CSS = `.uplot, .uplot *, .uplot *::before, .uplot *::after {box-sizing: border-box;}.uplot {font-family: inherit;line-height: 1.5;width: min-content;}.u-title {text-align: center;font-size: 18px;font-weight: bold;}.u-wrap {position: relative;user-select: none;}.u-over, .u-under {position: absolute;}.u-under {overflow: hidden;}.uplot canvas {display: block;position: relative;width: 100%;height: 100%;}.u-axis {position: absolute;}.u-legend {font-size: 14px;margin: auto;text-align: center;}.u-inline {display: block;}.u-inline * {display: inline-block;}.u-inline tr {margin-right: 16px;}.u-legend th {font-weight: 600;}.u-legend th > * {vertical-align: middle;display: inline-block;}.u-legend .u-marker {width: 1em;height: 1em;margin-right: 4px;background-clip: padding-box !important;}.u-inline.u-live th::after {content: ":";vertical-align: middle;}.u-inline:not(.u-live) .u-value {display: none;}.u-series > * {padding: 4px;}.u-series th {cursor: pointer;}.u-legend .u-off > * {opacity: 0.3;}.u-select {background: rgba(0,0,0,0.07);position: absolute;pointer-events: none;}.u-cursor-x, .u-cursor-y {position: absolute;left: 0;top: 0;pointer-events: none;will-change: transform;}.u-hz .u-cursor-x, .u-vt .u-cursor-y {height: 100%;border-right: 1px dashed #607D8B;}.u-hz .u-cursor-y, .u-vt .u-cursor-x {width: 100%;border-bottom: 1px dashed #607D8B;}.u-cursor-pt {position: absolute;top: 0;left: 0;border-radius: 50%;border: 0 solid;pointer-events: none;will-change: transform;background-clip: padding-box !important;}.u-axis.u-off, .u-select.u-off, .u-cursor-x.u-off, .u-cursor-y.u-off, .u-cursor-pt.u-off {display: none;}`;

/* COLOUR SCHEME — same three-way resolution as lab-matrix (see styles.ts header):
   :host = light, @media dark = follow the OS, :host([data-scheme=…]) = pinned by a
   host page that hard-codes one palette (natalga.com's labs page). Pages that never
   set the attribute (isayenko.org) keep following the visitor's colour scheme. */
const SCHEME_LIGHT = `
  --_fg: var(--fg, #1a1a1a);
  --_bg: var(--bg, #ffffff);
  --_muted: var(--muted, #777777);
  --_rule: var(--rule, #cccccc);
  --_rule-soft: var(--rule-soft, #e4e4e4);
  --_accent: var(--accent, #2f6f9f);
  --_tip-ok: #1e8449;
  --_warn: var(--z-warn, #8a5a00);
`;
const SCHEME_DARK = `
  --_fg: var(--fg, #d6d6d6);
  --_bg: var(--bg, #121212);
  --_muted: var(--muted, #9a9a9a);
  --_rule: var(--rule, #3a3a3a);
  --_rule-soft: var(--rule-soft, #2c2c2c);
  --_accent: var(--accent, #6fa8d4);
  --_tip-ok: #58d68d;
  --_warn: var(--z-warn, #d4ac0d);
`;

export const EXPLORE_STYLES = `
:host {
  ${SCHEME_LIGHT}
  display: block;
  color: var(--_fg);
}
/* [hidden] must win over the :host{display:block} above, or <lab-explore hidden>
   stays visible and the chart leaks under every non-explore tab. */
:host([hidden]) { display: none !important; }
@media (prefers-color-scheme: dark) {
  :host {
    ${SCHEME_DARK}
  }
}
:host([data-scheme="light"]) {
  ${SCHEME_LIGHT}
}
:host([data-scheme="dark"]) {
  ${SCHEME_DARK}
}
.muted { color: var(--_muted); }
/* The view's name — the first heading on the labs page (the page's own <h1> is
   visually hidden), so it is sized as a real section title, not chart chrome. */
.explore-title { margin: 0 0 0.3rem; font-size: 1.25rem; line-height: 1.25; font-weight: 600; }
.hpg-note { font-size: 0.82rem; margin: 0 0 0.4rem; }
.hpg-auto { font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer; }

.chart-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin: 0.6rem 0 0.4rem; }
.zoom-ctrl { display: inline-flex; align-items: center; gap: 0.5rem; }
.zoom {
  font: inherit; font-size: 1.1rem; line-height: 1;
  width: 2rem; height: 2rem; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--_rule); border-radius: 3px;
  background: color-mix(in srgb, var(--_fg) 3%, var(--_bg)); color: var(--_fg); cursor: pointer;
}
.zoom:hover { border-color: var(--_accent); color: var(--_accent); }
.zoom:disabled { opacity: 0.3; cursor: default; border-color: var(--_rule-soft); }
.zoom-label { min-width: 5.5rem; text-align: center; font-size: 0.88rem; font-variant-numeric: tabular-nums; }

.src-toggles { display: flex; gap: 1.1rem; flex-wrap: wrap; font-size: 0.85rem; margin: 0 0 0.6rem; }
.src-toggles label { display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer; }
.tog-label { font-size: 0.82rem; }

.axis-caps { display: flex; justify-content: space-between; font-size: 0.8rem; margin: 0.4rem 0 0; }
.axis-caps .cap-left { color: var(--_muted); }

.chart-wrap { margin-top: 0.4rem; }

/* marker picker — panels are rectangles, markers are togglable badges */
.marker-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.7rem; margin-top: 1.4rem; align-items: start; }
.picker-panel { border: 1px solid var(--_rule-soft); border-radius: 6px; padding: 0.5rem 0.6rem 0.6rem; }
.picker-cap { display: block; width: 100%; text-align: left; font: inherit; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--_muted); margin-bottom: 0.45rem; background: none; border: 0; padding: 0; cursor: pointer; }
.picker-cap:hover { color: var(--_fg); text-decoration: underline; }
.picker-badges { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.mbadge { font: inherit; font-size: 0.8rem; line-height: 1; padding: 0.32rem 0.55rem; border: 1px solid var(--_rule-soft); border-radius: 999px; background: transparent; color: var(--_fg); cursor: pointer; transition: background 0.12s, border-color 0.12s, color 0.12s; }
.mbadge:hover { border-color: var(--_muted); }
.mbadge.on { color: #fff; font-weight: 500; }
/* ⚠ MARKER — its reference range is unsourced or written for the other sex, so the
   0–100 % it would plot at is a percentage of the wrong thing. The badge carries the
   ⚠ in its own label (see #buildPicker) and a dashed border that ECHOES the dashed
   line it will draw on the chart, so the badge and the series are recognisably the
   same claim. It stays fully selectable: the trend is still worth seeing, it is the
   VERDICT that is not available. */
.mbadge.warn { border-style: dashed; border-color: var(--_warn); }
.mbadge.warn.on { border-style: dashed; border-color: var(--_warn); }
/* NEVER TAKEN — named, unselectable, obviously inert. Not hidden (it exists, and it
   is the one she could go and ask for) and never plotted (there is no value; 0 %
   would read as catastrophically low). */
.mbadge.nodata { border-style: dotted; color: var(--_muted); cursor: default; opacity: 0.85; }
.mbadge.nodata:hover { border-color: var(--_rule-soft); }

/* The ⚠ footnote under the plot — prose, because a glyph cannot say WHY. */
.dq-foot {
  margin: 0.55rem 0 0; padding: 0.5rem 0.65rem;
  font-size: 0.82rem; line-height: 1.45;
  color: var(--_fg); border-left: 3px solid var(--_warn);
  background: color-mix(in srgb, var(--_warn) 8%, transparent);
}
.dq-foot[hidden] { display: none; }

/* hover tooltip on chart points */
.u-tip {
  position: absolute; top: 0; left: 0; pointer-events: none;
  background: var(--_bg); border: 1px solid var(--_rule); border-radius: 3px;
  padding: 0.4rem 0.55rem; font-size: 0.8rem; line-height: 1.5;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2); white-space: nowrap; z-index: 10;
}
.u-tip-date { font-weight: 600; margin-bottom: 0.15rem; }
.u-tip-row { display: flex; align-items: center; gap: 0.35rem; }
.u-tip-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.u-tip-ok { color: var(--_tip-ok); font-weight: 600; }
.u-tip-warn { color: var(--_warn); font-weight: 700; }

.uplot, .u-legend { font-family: inherit; color: var(--_fg); }
.u-legend { font-size: 0.78rem; }
/* dragging the chart pans it (touch) instead of scrolling/zooming the page */
.uplot .u-over { touch-action: none; }
`;
