// Ported near-verbatim from project-moodtracker's web/chart3d-camera.js
// (its docs/tasks/task-0025.md) -- a domain-agnostic orbit-camera engine:
// yaw/pitch/zoom state, the perspective-projection math, and the
// pointer/wheel/touch interaction that drives them. Knows nothing about
// what gets drawn -- see chart3d-stacked-core.ts for that.
//
// Behavior and math are unchanged from the source. The only addition is
// `destroy()` on the returned camera, needed because this lives inside a
// React component that can mount/unmount many times (the source page never
// tore its charts down).

export const DEG = Math.PI / 180;

export interface ProjectedPoint {
  sx: number;
  sy: number;
  depth: number;
}

export type ProjectFn = (
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  sz: number,
  refScale: number,
) => ProjectedPoint;

export interface OrbitCamera3DOptions {
  defaultYaw: number;
  defaultPitch: number;
  yawMin: number;
  yawMax: number;
  pitchMin: number;
  pitchMax: number;
  cameraDist?: number;
  // `enableZoom` gates every zoom-related capability at once (wheel/pinch
  // input, double-tap-to-reset on touch, and disabling the CSS pan-y
  // default so pinch gestures aren't fought by native scrolling).
  enableZoom?: boolean;
  defaultZoom?: number;
  zoomMin?: number;
  zoomMax?: number;
  onChange?: () => void;
}

export interface OrbitCamera3D {
  project: ProjectFn;
  resetView: () => void;
  goTo: (targetYaw: number, targetPitch: number, targetZoom: number) => void;
  setLocked: (value: boolean) => void;
  getYaw: () => number;
  getPitch: () => number;
  getZoom: () => number;
  destroy: () => void;
}

export const createOrbitCamera3D = (
  canvas: HTMLCanvasElement,
  {
    defaultYaw,
    defaultPitch,
    yawMin,
    yawMax,
    pitchMin,
    pitchMax,
    cameraDist = 4.5,
    enableZoom = false,
    defaultZoom = 1,
    zoomMin = 0.5,
    zoomMax = 2.5,
    onChange = () => {},
  }: OrbitCamera3DOptions,
): OrbitCamera3D => {
  let yaw = defaultYaw;
  let pitch = defaultPitch;
  let zoom = defaultZoom;

  const clampYaw = (y: number) => Math.min(yawMax, Math.max(yawMin, y));
  const clampPitch = (p: number) => Math.min(pitchMax, Math.max(pitchMin, p));
  const clampZoom = (z: number) => Math.min(zoomMax, Math.max(zoomMin, z));

  // Rotates a normalised world point (-1..1 per axis, already axis-scaled by
  // the caller) by yaw (around the vertical axis) then pitch (around the
  // horizontal axis), then applies a perspective division so far-away parts
  // appear smaller. `depth` is the camera-space Z after both rotations:
  // smaller is nearer the viewer -- each chart uses this for its own
  // painter's-algorithm sort, this module doesn't sort anything itself.
  const project: ProjectFn = (x, y, z, cx, cy, sx, sy, sz, refScale) => {
    const wx = x * sx;
    const wy = y * sy;
    const wz = z * sz;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const x1 = wx * cosYaw - wz * sinYaw;
    const z1 = wx * sinYaw + wz * cosYaw;
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const y2 = wy * cosPitch + z1 * sinPitch;
    const depth = z1 * cosPitch - wy * sinPitch;
    const scale = cameraDist / (cameraDist + depth / refScale);
    const sx2 = cx + x1 * scale;
    const sy2 = cy - y2 * scale;
    return { sx: cx + (sx2 - cx) * zoom, sy: cy + (sy2 - cy) * zoom, depth };
  };

  const RESET_DURATION_MS = 750;
  let animFrame: number | null = null;

  // Animated rather than an instant jump, so the room doesn't snap
  // disorientingly from wherever it was -- eased with a cubic ease-out (fast
  // start, gentle settle) over RESET_DURATION_MS. `goTo` takes an arbitrary
  // target (used to return to a pre-edit view); `resetView` is just `goTo`
  // aimed at the configured defaults.
  const goTo = (targetYaw: number, targetPitch: number, targetZoom: number) => {
    if (animFrame !== null) cancelAnimationFrame(animFrame);
    const startYaw = yaw;
    const startPitch = pitch;
    const startZoom = zoom;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / RESET_DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      yaw = startYaw + (targetYaw - startYaw) * eased;
      pitch = startPitch + (targetPitch - startPitch) * eased;
      zoom = startZoom + (targetZoom - startZoom) * eased;
      onChange();
      if (t < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        yaw = targetYaw;
        pitch = targetPitch;
        zoom = targetZoom;
        animFrame = null;
        onChange();
      }
    };
    animFrame = requestAnimationFrame(step);
  };

  const resetView = () => goTo(defaultYaw, defaultPitch, defaultZoom);

  // While locked, drag/pinch/wheel input is ignored -- the camera can still
  // be moved programmatically (goTo/resetView), just not by the user.
  let locked = false;
  const setLocked = (value: boolean) => {
    locked = value;
  };

  const pointers = new Map<number, { x: number; y: number }>();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pinchStartDist = 0;
  let pinchStartZoom = defaultZoom;
  let lastTapTime = 0;
  let lastTapPos: { x: number; y: number } | null = null;

  const pointerDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (event: PointerEvent) => {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* no active pointer to capture */
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      if (enableZoom && event.pointerType === "touch") {
        const now = performance.now();
        if (
          !locked
          && lastTapPos
          && now - lastTapTime < 300
          && pointerDist(lastTapPos, { x: event.clientX, y: event.clientY }) < 24
        ) {
          resetView();
          lastTapTime = 0;
          lastTapPos = null;
          return;
        }
        lastTapTime = now;
        lastTapPos = { x: event.clientX, y: event.clientY };
      }
    } else if (enableZoom && pointers.size === 2) {
      dragging = false;
      const [a, b] = [...pointers.values()];
      pinchStartDist = pointerDist(a, b);
      pinchStartZoom = zoom;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (locked) return;

    if (enableZoom && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = pointerDist(a, b);
      if (pinchStartDist > 0) {
        zoom = clampZoom(pinchStartZoom * (d / pinchStartDist));
        onChange();
      }
      return;
    }

    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    yaw = clampYaw(yaw + dx * 0.008);
    pitch = clampPitch(pitch + dy * 0.008);
    onChange();
  };

  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    pinchStartDist = 0;
    if (pointers.size === 0) {
      dragging = false;
    } else {
      const [remaining] = [...pointers.values()];
      dragging = true;
      lastX = remaining.x;
      lastY = remaining.y;
    }
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (locked) return;
    zoom = clampZoom(zoom * Math.exp(-event.deltaY * 0.001));
    onChange();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("dblclick", resetView);
  if (enableZoom) {
    // Pinch-zoom needs raw two-finger pointer events, not the browser's own
    // gesture handling.
    canvas.style.touchAction = "none";
    canvas.addEventListener("wheel", onWheel, { passive: false });
  }

  const destroy = () => {
    if (animFrame !== null) cancelAnimationFrame(animFrame);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", endPointer);
    canvas.removeEventListener("pointercancel", endPointer);
    canvas.removeEventListener("dblclick", resetView);
    if (enableZoom) canvas.removeEventListener("wheel", onWheel);
  };

  return {
    project,
    resetView,
    goTo,
    setLocked,
    getYaw: () => yaw,
    getPitch: () => pitch,
    getZoom: () => zoom,
    destroy,
  };
};

// Shared by both 3D charts: resize the canvas's backing store to match its
// CSS size at the current device pixel ratio, so drawing stays crisp on
// high-DPI screens.
export const resizeCanvasBackingStore = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  rect: { width: number; height: number },
) => {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};
