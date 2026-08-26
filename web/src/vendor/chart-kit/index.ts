/**
 * @alexisayenko/chart-kit — domain-agnostic time-navigation harness for uPlot
 * health charts. Extracted from homepage/natalga `labchart.js` per ADR-0010;
 * semantics are a 1:1 port (parity with the copied file is a feature).
 */

export { navigator } from "./navigator";
export type { Navigator, NavigatorConfig, ZoomStep } from "./navigator";
export { tooltip } from "./tooltip";
export type { TooltipPlot, TooltipRender } from "./tooltip";
export { theme } from "./theme";
export type { Theme } from "./theme";
export { xAxis, xAxisValues } from "./axis";
export { smoothScale } from "./scale";
export type { ScalePlot, SetTarget } from "./scale";
export { eventBands } from "./events";
export type { EventBand, EventPeriod, EventPlot, EventBandsConfig } from "./events";
export { isoDate, monthYear, MON } from "./dates";

// uPlot is re-exported so component consumers construct charts from the same
// bundled copy instead of loading a second vendored script.
export { default as uPlot } from "uplot";
