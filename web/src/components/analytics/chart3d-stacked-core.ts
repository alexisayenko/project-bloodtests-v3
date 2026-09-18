// Ported from project-moodtracker's chart3d-stacked.js, generalized from 8
// fixed slots to N series; the host component owns state and controls.

import {
  DEG,
  createOrbitCamera3D,
  resizeCanvasBackingStore,
  type OrbitCamera3D,
} from "./chart3d-camera";

const TAU = Math.PI * 2;
const DEFAULT_YAW = -23 * DEG;
const DEFAULT_PITCH = 39 * DEG;
const YAW_MIN = -89 * DEG;
const YAW_MAX = 89 * DEG;
const PITCH_MIN = -5 * DEG;
const PITCH_MAX = 89 * DEG;

const DEFAULT_ZOOM = 1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

// Ribbon half-width as a ratio of depth-slot spacing (0.08/0.25 in the source),
// capped so one or two series still read as ribbons rather than slabs.
const HALF_WIDTH_RATIO = 0.32;
const HALF_WIDTH_MAX = 0.25;

// Sub-segments per raw segment: fixes painter's-algorithm depth-sort accuracy, not smoothing.
const PATH_STEPS = 6;

const X_CENTER = 0;

// The time axis spans -xHalf..xHalf, stretched per draw so the projected room fills X_FILL of the width.
const X_HALF_MIN = 1;
const X_HALF_MAX = 6;
const X_FILL = 0.9;

const FACE_ALPHA = {
  translucent: { front: 0.55, back: 0.35, top: 0.75 },
  opaque: { front: 1, back: 1, top: 1 },
};

export type OpacityMode = "translucent" | "opaque";

export interface StackedSeriesPoint {
  t: number; // epoch ms
  value: number;
}

export interface StackedSeriesInput {
  id: string;
  label: string;
  color: readonly [number, number, number];
  points: StackedSeriesPoint[];
}

export interface StackedChart3DOptions {
  opacityMode?: OpacityMode;
}

export interface StackedChart3DHandle {
  update: (series: StackedSeriesInput[]) => void;
  setOpacityMode: (mode: OpacityMode) => void;
  setRange: (startMs: number, endMs: number) => void;
  resetView: () => void;
  destroy: () => void;
}

interface PlotPoint {
  nx: number;
  ny: number;
}

interface PlotSeries {
  id: string;
  label: string;
  color: readonly [number, number, number];
  zOffset: number;
  values: PlotPoint[];
}

const fmtDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })} ${d.getFullYear()}`;
};

// yyyy-MM-dd parses to LOCAL midnight so fmtDate's local formatting doesn't slip a day west of UTC.
export const parseObservationDate = (dateStr: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return Date.parse(dateStr);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
};

const toRgb = (c: readonly [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const toRgba = (c: readonly [number, number, number], alpha: number) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

export const initStackedChart3D = (
  canvas: HTMLCanvasElement,
  options: StackedChart3DOptions = {},
): StackedChart3DHandle => {
  const ctx = canvas.getContext("2d");
  // No-op handle rather than null, so callers need no null check.
  if (!ctx) {
    return {
      update: () => {},
      setOpacityMode: () => {},
      setRange: () => {},
      resetView: () => {},
      destroy: () => {},
    };
  }

  let opacityMode: OpacityMode = options.opacityMode ?? "translucent";
  let rawSeries: StackedSeriesInput[] = [];
  let series: PlotSeries[] = [];
  let halfWidth = 0.08;
  let timeFirst = 0;
  let timeLast = 0;
  let hasPlottableData = false;
  let rafPending = false;

  let windowKind: "all" | "range" = "all";
  let windowStart = 0;
  let windowEnd = 0;

  const camera: OrbitCamera3D = createOrbitCamera3D(canvas, {
    defaultYaw: DEFAULT_YAW,
    defaultPitch: DEFAULT_PITCH,
    yawMin: YAW_MIN,
    yawMax: YAW_MAX,
    pitchMin: PITCH_MIN,
    pitchMax: PITCH_MAX,
    enableZoom: true,
    defaultZoom: DEFAULT_ZOOM,
    zoomMin: ZOOM_MIN,
    zoomMax: ZOOM_MAX,
    onChange: () => scheduleDraw(),
  });
  const { project } = camera;

  const updateAria = () => {
    const pointCount = series.reduce((sum, s) => sum + s.values.length, 0);
    const windowText = windowKind === "all"
      ? "Showing all time."
      : `Showing ${fmtDate(timeFirst)} to ${fmtDate(timeLast)}.`;
    canvas.setAttribute(
      "aria-label",
      `Biomarkers compared in 3D — time left to right, value bottom to top, each biomarker on `
        + `its own depth plane. ${windowText} ${pointCount} ${pointCount === 1 ? "point" : "points"} plotted `
        + `across ${series.length} ${series.length === 1 ? "biomarker" : "biomarkers"}. `
        + `Drag to rotate, scroll or pinch to zoom, double-click or double-tap to reset.`,
    );
  };

  const projectionParams = (rect: { width: number; height: number }) => {
    const W = rect.width;
    const H = rect.height;
    const base = Math.min(W, H);
    return {
      cx: W / 2,
      cy: H / 2,
      refScale: base * 0.55,
      scaleX: base * 0.55 * 1.125,
      scaleY: H * 0.34 * 0.75,
      scaleZ: base * 0.22,
    };
  };

  type Params = ReturnType<typeof projectionParams>;

  const ROOM_CORNERS = [
    [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],
    [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1],
  ] as const;

  let xHalf = X_HALF_MIN;

  // Perspective makes projected width only roughly proportional to xHalf, so
  // iterate; zoom is factored out so the fit doesn't cancel it.
  const fitXHalf = (W: number, p: Params) => {
    const zoom = camera.getZoom();
    for (let i = 0; i < 3; i += 1) {
      let minX = Infinity;
      let maxX = -Infinity;
      for (const [x, y, z] of ROOM_CORNERS) {
        const { sx } = project(x * xHalf, y, z, p.cx, p.cy, p.scaleX, p.scaleY, p.scaleZ, p.refScale);
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
      }
      const width = (maxX - minX) / zoom;
      if (Number.isNaN(width) || width <= 0) break;
      xHalf = Math.min(X_HALF_MAX, Math.max(X_HALF_MIN, xHalf * ((X_FILL * W) / width)));
    }
    return xHalf;
  };

  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    resizeCanvasBackingStore(canvas, ctx, rect);

    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);
    if (!hasPlottableData) return;

    const params = projectionParams(rect);
    const xh = fitXHalf(W, params);
    const P = (x: number, y: number, z: number) =>
      project(x * xh, y, z, params.cx, params.cy, params.scaleX, params.scaleY, params.scaleZ, params.refScale);

    ctx.lineWidth = 1;

    const floor = ([[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] as const).map(([x, y, z]) => P(x, y, z));
    ctx.beginPath();
    floor.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
    ctx.closePath();
    ctx.fillStyle = "rgba(28, 31, 36, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(28, 31, 36, 0.5)";
    ctx.stroke();

    const backZ = P(0, 0, -1).depth > P(0, 0, 1).depth ? -1 : 1;
    const backWall = ([[-1, -1, backZ], [1, -1, backZ], [1, 1, backZ], [-1, 1, backZ]] as const).map(([x, y, z]) => P(x, y, z));
    ctx.beginPath();
    backWall.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
    ctx.closePath();
    ctx.fillStyle = "rgba(28, 31, 36, 0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(28, 31, 36, 0.15)";
    ctx.stroke();

    const leftWall = ([[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] as const).map(([x, y, z]) => P(x, y, z));
    ctx.beginPath();
    leftWall.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
    ctx.closePath();
    ctx.fillStyle = "rgba(28, 31, 36, 0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(28, 31, 36, 0.15)";
    ctx.stroke();

    type Prim = { depth: number; draw: () => void };
    const prims: Prim[] = [];
    const alpha = FACE_ALPHA[opacityMode];

    for (const s of series) {
      const zFront = s.zOffset + halfWidth;
      const zBack = s.zOffset - halfWidth;
      const edgeColor = toRgb(s.color);
      const frontFill = toRgba(s.color, alpha.front);
      const backFill = toRgba(s.color, alpha.back);
      const topFill = toRgba(s.color, alpha.top);

      const fillQuad = (
        a: { sx: number; sy: number },
        b: { sx: number; sy: number },
        c: { sx: number; sy: number },
        d: { sx: number; sy: number },
        color: string,
      ) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.lineTo(c.sx, c.sy);
        ctx.lineTo(d.sx, d.sy);
        ctx.closePath();
        ctx.fill();
      };
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

      for (let i = 0; i < s.values.length - 1; i += 1) {
        const p0 = s.values[i];
        const p1 = s.values[i + 1];

        for (let step = 0; step < PATH_STEPS; step += 1) {
          const tA = step / PATH_STEPS;
          const tB = (step + 1) / PATH_STEPS;
          const a = { nx: lerp(p0.nx, p1.nx, tA), ny: lerp(p0.ny, p1.ny, tA) };
          const b = { nx: lerp(p0.nx, p1.nx, tB), ny: lerp(p0.ny, p1.ny, tB) };

          const topF0 = P(a.nx, a.ny, zFront);
          const topF1 = P(b.nx, b.ny, zFront);
          const botF0 = P(a.nx, -1, zFront);
          const botF1 = P(b.nx, -1, zFront);

          const topB0 = P(a.nx, a.ny, zBack);
          const topB1 = P(b.nx, b.ny, zBack);
          const botB0 = P(a.nx, -1, zBack);
          const botB1 = P(b.nx, -1, zBack);

          prims.push(
            {
              depth: (topF0.depth + topF1.depth) / 2,
              draw: () => fillQuad(topF0, topF1, botF1, botF0, frontFill),
            },
            {
              depth: (topB0.depth + topB1.depth) / 2,
              draw: () => fillQuad(topB0, topB1, botB1, botB0, backFill),
            },
            {
              depth: (topF0.depth + topF1.depth + topB0.depth + topB1.depth) / 4,
              draw: () => fillQuad(topF0, topF1, topB1, topB0, topFill),
            },
            {
              depth: (topF0.depth + topF1.depth) / 2 - 0.001,
              draw: () => {
                ctx.save();
                ctx.strokeStyle = edgeColor;
                ctx.lineWidth = 2;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(topF0.sx, topF0.sy);
                ctx.lineTo(topF1.sx, topF1.sy);
                ctx.stroke();
                ctx.restore();
              },
            },
          );
        }
      }

      for (const point of s.values) {
        const p = P(point.nx, point.ny, zFront);
        prims.push({
          depth: p.depth - 0.002,
          draw: () => {
            ctx.save();
            ctx.fillStyle = edgeColor;
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, 2.5, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
          },
        });
      }
    }

    prims.sort((a, b) => b.depth - a.depth);
    for (const prim of prims) prim.draw();

    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#5d6470";

    const timeStart = P(-1, -1, -1);
    const timeEnd = P(1, -1, -1);
    ctx.textAlign = "left";
    ctx.fillText(fmtDate(timeFirst), timeStart.sx, timeStart.sy + 16);
    ctx.textAlign = "right";
    ctx.fillText(fmtDate(timeLast), timeEnd.sx, timeEnd.sy + 16);

    ctx.font = "600 11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    for (const s of series) {
      const label = P(-1, 1.15, s.zOffset);
      ctx.fillStyle = toRgb(s.color);
      ctx.fillText(s.label, label.sx, label.sy);
    }
  };

  const scheduleDraw = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      draw();
    });
  };

  let resizeObserver: ResizeObserver | null = null;
  const onWindowResize = () => scheduleDraw();
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => scheduleDraw());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", onWindowResize);
  }

  // Slot i of n sits at the midpoint of the i-th equal partition of [-1, 1].
  const zOffsetFor = (index: number, count: number) => -1 + (2 * index + 1) / count;

  // Each series normalizes against its OWN min/max within the visible window,
  // so mixed units share one chart; a flat series gets valueT 0.5, not a divide by zero.
  const buildSeries = (input: StackedSeriesInput, index: number, count: number, span: number): PlotSeries => {
    const zOffset = zOffsetFor(index, count);
    const points = input.points
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.value))
      .filter((p) => p.t >= timeFirst && p.t <= timeLast)
      .sort((a, b) => a.t - b.t);

    if (points.length === 0) {
      return { id: input.id, label: input.label, color: input.color, zOffset, values: [] };
    }

    const min = Math.min(...points.map((p) => p.value));
    const max = Math.max(...points.map((p) => p.value));
    const range = max - min;

    return {
      id: input.id,
      label: input.label,
      color: input.color,
      zOffset,
      values: points.map((p) => {
        const valueT = range > 0 ? (p.value - min) / range : 0.5;
        return {
          nx: span > 0 ? ((p.t - timeFirst) / span) * 2 - 1 : X_CENTER,
          ny: valueT * 2 - 1,
        };
      }),
    };
  };

  const computeOverallRange = (): { min: number; max: number } | null => {
    const times = rawSeries.flatMap((s) =>
      s.points.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.value)).map((p) => p.t));
    if (times.length === 0) return null;
    return { min: Math.min(...times), max: Math.max(...times) };
  };

  // The window's near edge may not pass the data's boundary, so an extreme range keeps the boundary date in view.
  const clampWindow = () => {
    const overall = computeOverallRange();
    if (!overall) return;
    const width = windowEnd - windowStart;
    if (windowEnd < overall.min) {
      windowEnd = overall.min;
      windowStart = windowEnd - width;
    } else if (windowStart > overall.max) {
      windowStart = overall.max;
      windowEnd = windowStart + width;
    }
  };

  const applyWindow = () => {
    if (windowKind === "all") {
      const overall = computeOverallRange();
      timeFirst = overall ? overall.min : 0;
      timeLast = overall ? overall.max : 0;
    } else {
      timeFirst = windowStart;
      timeLast = windowEnd;
    }

    const span = timeLast - timeFirst;
    const count = Math.max(rawSeries.length, 1);
    halfWidth = Math.min(HALF_WIDTH_MAX, (2 / count) * HALF_WIDTH_RATIO);

    series = rawSeries.map((s, i) => buildSeries(s, i, count, span));
    hasPlottableData = series.some((s) => s.values.length > 0);

    updateAria();
    scheduleDraw();
  };

  // Toggling series can move the data extent out from under a set range, so re-clamp here too.
  const update = (nextSeries: StackedSeriesInput[]) => {
    rawSeries = nextSeries;
    if (windowKind !== "all") clampWindow();
    applyWindow();
  };

  const setOpacityMode = (mode: OpacityMode) => {
    opacityMode = mode;
    scheduleDraw();
  };

  // An explicit closed interval, clipped to the data extent and normalized.
  const setRange = (startMs: number, endMs: number) => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
    windowKind = "range";
    windowStart = Math.min(startMs, endMs);
    windowEnd = Math.max(startMs, endMs);
    clampWindow();
    applyWindow();
  };

  const destroy = () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", onWindowResize);
    camera.destroy();
  };

  updateAria();
  scheduleDraw();

  return {
    update,
    setOpacityMode,
    setRange,
    resetView: camera.resetView,
    destroy,
  };
};
