/**
 * <lab-explore> — overlay blood markers on one time chart, each normalized to
 * % of its reference range. Behavior port of the homepage Explore include
 * (explore.njk) onto @alexisayenko/chart-kit, per ADR-0010. Same features:
 * marker picker (panel-grouped badges), zoom/pan with persisted view, event
 * bands, autoscale toggle, actual-value tooltip; same localStorage keys by
 * default so existing users keep their state.
 *
 * Charts need a 2D canvas; in DOM-only environments (happy-dom tests, SSR)
 * everything except the plot itself still renders and works.
 */

import {
  uPlot,
  navigator,
  tooltip,
  theme,
  xAxis,
  smoothScale,
  eventBands,
  monthYear,
  type Navigator,
  type SetTarget,
} from "../chart-kit";
import type { ExploreMarker, ExploreNotTaken, LabExploreModel } from "./explore-types";
import { EXPLORE_STYLES, UPLOT_CSS } from "./explore-styles";

const esc = (s: unknown): string =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!),
  );

/** Tooltip value precision: fewer decimals the larger the magnitude (100 -> 0, 10 -> 1, 1 -> 2, else 3). */
const fmtVal = (v: number): string => {
  const dec = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : Math.abs(v) >= 1 ? 2 : 3;
  return String(Number(v.toFixed(dec)));
};

const PALETTE = [
  "#9f2f28", "#2f6f9f", "#1e8449", "#b8860b", "#7d3c98", "#16a085", "#c0392b", "#5d6d7e",
  "#d35400", "#2980b9", "#27ae60", "#8e44ad", "#d4ac0d", "#a93226", "#1abc9c", "#e67e22",
];

const DEFAULT_STEPS = [
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
  { label: "2 years", days: 730 },
  { label: "3 years", days: 1095 },
  { label: "5 years", days: 1825 },
  { label: "10 years", days: 3650 },
];

const DEFAULT_INTRO =
  "Pick markers below to overlay them, normalized to % of each marker's reference range " +
  "(0–100 % = within normal, shaded). Hover for actual values · drag to scroll · −/+ to zoom.";

const DEFAULT_INTRO_ABSOLUTE =
  "Pick markers below to overlay them, each plotted at its own actual value on one shared " +
  "axis (no unit shown on the axis -- hover a point for its own unit). Drag to scroll · −/+ to zoom.";

/** English fallbacks for the chart's chrome; a host page overrides via model.labels. */
const DEFAULT_LABELS = {
  // v3 DEVIATION from the v2 source: v2 always captions a never-taken chip
  // ("never taken"); v3 wants the bare marker name instead, so the default
  // is empty here and `#lbl("notTaken")` is checked for truthiness at its
  // one call site below. A host that still wants the caption can opt back
  // in via model.labels.notTaken.
  notTaken: "",
  dataQuality:
    "their reference range is not trustworthy (unsourced, or written for the other sex), " +
    "so read their position on this chart as a hint, not as a verdict.",
  axisPct: "% of reference range",
  events: "Events:",
  autoscale: "Autoscale vertical",
  panelToggle: "Select / deselect all in this group",
};

interface UsedMarker extends ExploreMarker {
  key: string;
}

function ts(s: string): number {
  return Date.parse(s) / 1000;
}

function canvasSupported(): boolean {
  try {
    return !!document.createElement("canvas").getContext("2d");
  } catch {
    return false;
  }
}

export class LabExplore extends HTMLElement {
  #model: LabExploreModel | null = null;
  #root: ShadowRoot;

  // selection
  #sel: string[] = [];
  #selSet: Record<string, 1> = {};

  // chart state (rebuilt on every selection change)
  #u: uPlot | null = null;
  #used: UsedMarker[] = [];
  #abs: (number | null)[][] = [];
  #labs: (string | undefined)[][] = [];
  #refMins: (number | null)[][] = [];
  #refMaxs: (number | null)[][] = [];
  #data: (number | null)[][] = [];
  #x: number[] = [];
  #gdates: string[] = [];
  #allLo = 0;
  #allHi = 100;
  #setPct: SetTarget | null = null;
  #showTip: ((self: uPlot) => void) | null = null;
  #nav: Navigator | null = null;

  #colorMap: Record<string, string> = {};
  #colorN = 0;
  #ro: ResizeObserver | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  get model(): LabExploreModel | null {
    return this.#model;
  }

  set model(m: LabExploreModel | null) {
    this.#model = m;
    this.#render();
  }

  disconnectedCallback(): void {
    if (this.#u) {
      this.#u.destroy();
      this.#u = null;
    }
    this.#ro?.disconnect();
  }

  // ---- persistence -------------------------------------------------------

  #key(which: "sel" | "view" | "autoscale"): string {
    const p = this.#model?.persist;
    if (which === "sel") return p?.sel ?? "exploreSel";
    if (which === "view") return p?.view ?? "hpgChartView";
    return p?.autoscale ?? "hpgAutoscale";
  }

  #evKey(id: string): string {
    return (this.#model?.persist?.evPrefix ?? "exploreEv:") + id;
  }

  #saveSel(): void {
    try {
      localStorage.setItem(this.#key("sel"), JSON.stringify(this.#sel));
    } catch {
      /* private mode */
    }
  }

  // ---- render ------------------------------------------------------------

  /** A chrome string: the host's override, else the English default. */
  #lbl(k: keyof typeof DEFAULT_LABELS): string {
    return this.#model?.labels?.[k] || DEFAULT_LABELS[k];
  }

  #render(): void {
    const m = this.#model;
    if (this.#u) {
      this.#u.destroy();
      this.#u = null;
    }
    this.#ro?.disconnect();
    this.#ro = null;
    if (!m || !Object.keys(m.markers).length) {
      this.#root.innerHTML = `<style>${EXPLORE_STYLES}</style><p class="muted">No plottable markers.</p>`;
      return;
    }

    const events = m.events ?? [];
    const normalized = m.normalized !== false;
    this.#root.innerHTML =
      `<style>${UPLOT_CSS}${EXPLORE_STYLES}</style>` +
      // The view's own name. It is the first thing on the labs page — see
      // LabExploreModel.title for why it is a promise and not a label.
      (m.title ? `<h2 class="explore-title">${esc(m.title)}</h2>` : "") +
      `<p class="muted hpg-note">${m.intro ?? (normalized ? DEFAULT_INTRO : DEFAULT_INTRO_ABSOLUTE)}</p>` +
      `<div class="chart-toolbar">` +
      `<div class="zoom-ctrl">` +
      `<button type="button" class="zoom" data-zoom="out" aria-label="Zoom out">−</button>` +
      `<span class="zoom-label"></span>` +
      `<button type="button" class="zoom" data-zoom="in" aria-label="Zoom in">+</button>` +
      `</div>` +
      `<label class="hpg-auto"><input type="checkbox" data-autoscale> ${esc(this.#lbl("autoscale"))}</label>` +
      `</div>` +
      (events.length
        ? `<div class="src-toggles"><span class="tog-label muted">${esc(this.#lbl("events"))}</span>` +
          events
            .map(
              (ev) =>
                `<label><input type="checkbox" class="ev-tog" value="${esc(ev.id)}"${ev.defaultOn ? " checked" : ""}> ${esc(ev.label)}</label>`,
            )
            .join("") +
          `</div>`
        : "") +
      `<div class="axis-caps"><span class="cap-left">${normalized ? esc(this.#lbl("axisPct")) : ""}</span></div>` +
      `<div class="chart-wrap"></div>` +
      // The ⚠ footnote. Hidden while nothing flagged is plotted; filled by #refreshWarnFoot().
      `<p class="dq-foot" role="note" hidden></p>` +
      `<div class="marker-picker"></div>`;

    // selection: persisted → default
    this.#sel = [];
    try {
      const sv = JSON.parse(localStorage.getItem(this.#key("sel")) ?? "null");
      if (Array.isArray(sv)) this.#sel = sv as string[];
    } catch {
      /* fall back to defaults */
    }
    if (!this.#sel.length && !localStorage.getItem(this.#key("sel")))
      this.#sel = (m.defaultSelection ?? []).slice();
    this.#sel = this.#sel.filter((k) => k in m.markers);
    this.#selSet = {};
    for (const k of this.#sel) this.#selSet[k] = 1;

    // stable global date axis across all markers, so the timeline never shifts on toggle
    const gds: Record<string, 1> = {};
    for (const k of Object.keys(m.markers))
      for (const p of m.markers[k]!.data) gds[p[0]] = 1;
    this.#gdates = Object.keys(gds).sort();
    this.#x = this.#gdates.map(ts);

    this.#buildPicker();
    this.#wireToolbar();
    this.#refreshBadges();
    // Rebuilt here, not lazily in #makeChart(), because #render() is the only
    // place that recreates the toolbar's zoom-in/zoom-out/label elements: a
    // navigator bound once and kept across a later #render() (e.g. task-0052's
    // Normalized/Absolute toggle) would still hold onto those NOW-DETACHED
    // nodes, leaving the zoom buttons dead and the step label permanently
    // blank in the new toolbar. #makeChart() alone (a marker toggle) reuses
    // this same toolbar, so it must reuse this same navigator too.
    this.#makeNav();
    this.#makeChart();
  }

  #makeNav(): void {
    const m = this.#model!;
    const FULL = {
      min: this.#x.length ? this.#x[0]! : 0,
      max: this.#x.length ? this.#x[this.#x.length - 1]! : 1,
    };
    this.#nav = navigator({
      steps: m.steps ?? DEFAULT_STEPS,
      full: FULL,
      persistKey: this.#key("view"),
      defaultStepIdx: m.defaultStepIdx ?? 3, // default view: latest 3 years
      defaultAnchor: "end",
      overscroll: m.overscroll ?? 0.25, // only 25% empty room past the last point
      zoomIn: this.#root.querySelector<HTMLButtonElement>('[data-zoom="in"]'),
      zoomOut: this.#root.querySelector<HTMLButtonElement>('[data-zoom="out"]'),
      label: this.#root.querySelector<HTMLElement>(".zoom-label"),
      onApply: (xmin, xmax) => {
        if (!this.#u) return;
        this.#u.setScale("x", { min: xmin, max: xmax }); // x instant (pan); y eased via setPct
        // v3 ADDITION (task-0053): a sibling medication-history lane, rendered outside
        // this shadow root, mirrors the chart's own visible x-window -- onApply is the
        // one place that fires for every pan, zoom AND rebuild, so it's the correct spot
        // to announce it, as a plain DOM CustomEvent on the host rather than new public API.
        this.dispatchEvent(new CustomEvent("lab-explore-view", { detail: { xmin, xmax } }));
        if (this.#autoOn()) {
          // fit the % axis to the visible window
          let lo = Infinity,
            hi = -Infinity;
          for (let si = 1; si < this.#data.length; si++)
            for (let i = 0; i < this.#x.length; i++) {
              if (this.#x[i]! < xmin || this.#x[i]! > xmax) continue;
              const v = this.#data[si]![i];
              if (v == null) continue;
              if (v < lo) lo = v;
              if (v > hi) hi = v;
            }
          if (isFinite(lo)) {
            const p = (hi - lo) * 0.1 || 5;
            this.#setPct?.(lo - p, hi + p);
          } else this.#setPct?.(this.#allLo, this.#allHi);
        } else {
          this.#setPct?.(this.#allLo, this.#allHi); // eased toward the fixed full range
        }
      },
    });
  }

  #colorFor(k: string): string {
    if (!(k in this.#colorMap))
      this.#colorMap[k] = PALETTE[this.#colorN++ % PALETTE.length]!;
    return this.#colorMap[k]!;
  }

  #buildPicker(): void {
    const m = this.#model!;
    const picker = this.#root.querySelector(".marker-picker")!;
    const byPanel: Record<string, string[]> = {};
    const order: string[] = [];
    const add = (p: string): string[] => {
      if (!byPanel[p]) {
        byPanel[p] = [];
        order.push(p);
      }
      return byPanel[p]!;
    };
    // v3 DEVIATION from the v2 source: v2's ExploreMarker/ExploreNotTaken.panel
    // was always a single string, so this loop only ever added a key to one
    // group. v3 widened `panel` to `string | string[]` (see explore-types.ts)
    // so a marker genuinely shared by several panels groups under ALL of
    // them -- panelsOf() normalizes either shape, and the same key/badge just
    // gets appended to every relevant group's byPanel/ntByPanel bucket below.
    // The click/select state (#sel/#selSet) stays keyed by marker key, not by
    // (key, panel) pair, so every badge instance of a shared marker toggles
    // the same underlying series.
    const panelsOf = (p: string | string[]): string[] => (Array.isArray(p) ? p : [p]);
    for (const k of Object.keys(m.markers))
      for (const p of panelsOf(m.markers[k]!.panel)) add(p).push(k);
    // never-drawn markers ride in their own group box, so a group whose markers she
    // has ALL never had taken still appears — that group is the one worth reading.
    const nt = m.notTaken ?? [];
    const ntByPanel: Record<string, typeof nt> = {};
    for (const n of nt) {
      for (const p of panelsOf(n.panel)) {
        add(p);
        (ntByPanel[p] ??= []).push(n);
      }
    }

    // v3-side convention (see exploreModel.ts's INDEX_MARKER_KEY_PREFIX): a
    // computed-index marker's key carries this prefix, purely so the
    // single-panel picker below can tell it apart from a raw observation
    // marker without a new field on the vendored ExploreMarker/
    // ExploreNotTaken types.
    const isIndexKey = (k: string): boolean => k.startsWith("idx:");

    const mkBadge = (k: string): HTMLButtonElement => {
      const mk = m.markers[k]!;
      const b = document.createElement("button");
      b.type = "button";
      b.className = mk.warn ? "mbadge warn" : "mbadge";
      b.dataset.key = k;
      // ⚠ RIDES THE LABEL ITSELF, not a separate glyph elsewhere: the badge is the
      // one place she reads this marker's name before choosing to plot it, so the
      // caveat has to be attached to the name, the way it is in the table.
      b.textContent = mk.warn ? `⚠ ${mk.label}` : mk.label;
      b.addEventListener("click", () => this.#toggle(k));
      return b;
    };
    // NEVER TAKEN — present, named, and disabled. Not plotted (there is no value),
    // not omitted (it exists), not zero (0 % would read as catastrophically low).
    const mkNotTaken = (n: ExploreNotTaken): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mbadge nodata";
      b.disabled = true;
      b.dataset.key = n.key;
      // n.reason (see explore-types.ts) marks the OTHER disabled case — real
      // data on file that can't be normalized — so it always gets a visible
      // suffix, independent of the notTaken label opt-in above; the bare
      // never-drawn chip stays exactly as before.
      b.textContent = n.reason
        ? `${n.label} · ${n.reason}`
        : this.#lbl("notTaken")
          ? `${n.label} · ${this.#lbl("notTaken")}`
          : n.label;
      if (n.reason) b.title = n.reason;
      return b;
    };

    for (const pname of order) {
      // v3 DEVIATION from the v2 source: v2 always wraps each group in the
      // bordered `.picker-panel` box, captioned with its panel name. v3's Panel
      // Detail page pre-scopes `order` to that one panel (see PanelDetailView),
      // so a single-group picker showing a caption — or even just the box's
      // border around it — is pure noise — everything on screen already
      // belongs to it, and a bordered rectangle around a single badge row
      // still reads as "a group" with nothing to distinguish it from. Both the
      // box and its caption (and the caption's select-all-in-group toggle) are
      // only worth showing when they actually distinguish one group from
      // another, i.e. on pages like All Observations where `order` has
      // multiple panels; a single-group picker instead appends the badge row
      // straight to the picker root, unboxed.
      const box = order.length === 1 ? null : document.createElement("div");
      if (box) {
        box.className = "picker-panel";
        const cap = document.createElement("button");
        cap.type = "button";
        cap.className = "picker-cap";
        cap.textContent = pname;
        cap.title = this.#lbl("panelToggle");
        cap.addEventListener("click", () => this.#togglePanel(byPanel[pname] ?? []));
        box.appendChild(cap);
      }

      const keys = byPanel[pname] ?? [];
      const nts = ntByPanel[pname] ?? [];
      // Both the single-group (Panel Detail) and multi-group (All
      // Observations) pickers split a group's badges into an observations
      // row, then — only when that group actually has any index markers/
      // not-taken indices (buildExploreModel now builds those for both
      // contexts, see its doc comment) — the same pale-blue divider and a
      // second row of index badges below it. Only the CONTAINER differs: a
      // single-group picker has no box (see above) so both rows append
      // straight to the picker root; a multi-group picker scopes the split to
      // inside that group's own `.picker-panel` box, so the divider never
      // bleeds across groups.
      const obsKeys = keys.filter((k) => !isIndexKey(k));
      const idxKeys = keys.filter(isIndexKey);
      const obsNt = nts.filter((n) => !isIndexKey(n.key));
      const idxNt = nts.filter((n) => isIndexKey(n.key));
      const container = box ?? picker;

      const bb = document.createElement("div");
      bb.className = "picker-badges";
      for (const k of obsKeys) bb.appendChild(mkBadge(k));
      for (const n of obsNt) bb.appendChild(mkNotTaken(n));
      container.appendChild(bb);

      if (idxKeys.length || idxNt.length) {
        const divider = document.createElement("div");
        divider.className = "picker-index-divider";
        container.appendChild(divider);
        const ibb = document.createElement("div");
        ibb.className = "picker-badges";
        for (const k of idxKeys) ibb.appendChild(mkBadge(k));
        for (const n of idxNt) ibb.appendChild(mkNotTaken(n));
        container.appendChild(ibb);
      }

      if (box) picker.appendChild(box);
    }
  }

  #refreshBadges(): void {
    this.#root.querySelectorAll<HTMLElement>(".mbadge:not(.nodata)").forEach((b) => {
      const k = b.dataset.key!;
      const on = !!this.#selSet[k];
      b.classList.toggle("on", on);
      b.style.background = on ? this.#colorFor(k) : "";
      b.style.borderColor = on ? this.#colorFor(k) : "";
    });
  }

  /**
   * The ⚠ footnote under the chart — the last line of defence for the view's name.
   *
   * A dashed line and a ⚠ in a badge say "careful"; they do not say WHY, and a
   * reader who has just looked at a chart called «Что в норме, а что нет» is owed
   * the why in plain words. So whenever at least one flagged marker is on the plot,
   * it is named here, in prose, immediately under the picture it undermines. When
   * nothing flagged is plotted the line is not there at all — a permanent caveat is
   * a caveat nobody reads.
   */
  #refreshWarnFoot(): void {
    const foot = this.#root.querySelector<HTMLElement>(".dq-foot");
    if (!foot) return;
    const flagged = this.#used.filter((mk) => mk.warn);
    foot.hidden = !flagged.length;
    foot.textContent = flagged.length
      ? `⚠ ${flagged.map((mk) => mk.label).join(", ")} — ${this.#lbl("dataQuality")}`
      : "";
  }

  #toggle(k: string): void {
    if (this.#selSet[k]) {
      delete this.#selSet[k];
      this.#sel = this.#sel.filter((s) => s !== k);
    } else {
      this.#selSet[k] = 1;
      this.#sel.push(k);
    }
    this.#saveSel();
    this.#refreshBadges();
    this.#rebuildKeepScroll();
  }

  #togglePanel(keys: string[]): void {
    const anyOn = keys.some((k) => this.#selSet[k]);
    for (const k of keys) {
      if (anyOn) {
        // anything on → clear the whole panel
        delete this.#selSet[k];
        this.#sel = this.#sel.filter((s) => s !== k);
      } else if (!this.#selSet[k]) {
        this.#selSet[k] = 1;
        this.#sel.push(k);
      }
    }
    this.#saveSel();
    this.#refreshBadges();
    this.#rebuildKeepScroll();
  }

  #wireToolbar(): void {
    const asc = this.#root.querySelector<HTMLInputElement>("[data-autoscale]")!;
    try {
      asc.checked = localStorage.getItem(this.#key("autoscale")) === "1";
    } catch {
      /* default off */
    }
    asc.addEventListener("change", () => {
      try {
        localStorage.setItem(this.#key("autoscale"), asc.checked ? "1" : "0");
      } catch {
        /* private mode */
      }
      this.#nav?.apply();
    });

    // event overlay checkboxes (persisted) — a redraw is enough, no chart rebuild
    this.#root.querySelectorAll<HTMLInputElement>(".ev-tog").forEach((c) => {
      try {
        const s = localStorage.getItem(this.#evKey(c.value));
        if (s !== null) c.checked = s === "1";
      } catch {
        /* keep defaultOn */
      }
      c.addEventListener("change", () => {
        try {
          localStorage.setItem(this.#evKey(c.value), c.checked ? "1" : "0");
        } catch {
          /* private mode */
        }
        this.#u?.redraw();
      });
    });
  }

  #autoOn(): boolean {
    return !!this.#root.querySelector<HTMLInputElement>("[data-autoscale]")?.checked;
  }

  #activeEvents(): string[] {
    return Array.from(this.#root.querySelectorAll<HTMLInputElement>(".ev-tog:checked")).map(
      (c) => c.value,
    );
  }

  // ---- chart -------------------------------------------------------------

  #buildData(): void {
    const m = this.#model!;
    const normalized = m.normalized !== false;
    this.#used = this.#sel
      .filter((k) => k in m.markers)
      .map((k) => ({ key: k, ...m.markers[k]! }));
    this.#abs = [];
    this.#labs = [];
    this.#refMins = [];
    this.#refMaxs = [];
    this.#data = [this.#x];
    for (const mk of this.#used) {
      const map: Record<string, number> = {};
      const labMap: Record<string, string> = {};
      for (const p of mk.data) {
        map[p[0]] = p[1];
        if (p[2]) labMap[p[0]] = p[2];
      }
      const abs = this.#gdates.map((d) => (d in map ? map[d]! : null));
      const refMins = this.#gdates.map((d) => (d in map ? (mk.refBands?.[d]?.refMin ?? mk.refMin) : null));
      const refMaxs = this.#gdates.map((d) => (d in map ? (mk.refBands?.[d]?.refMax ?? mk.refMax) : null));
      this.#abs.push(abs);
      this.#labs.push(this.#gdates.map((d) => labMap[d]));
      this.#refMins.push(refMins);
      this.#refMaxs.push(refMaxs);
      this.#data.push(
        normalized
          ? this.#gdates.map((_, di) => {
              const v = abs[di];
              if (v == null) return null;
              const rMin = refMins[di] ?? mk.refMin;
              const rMax = refMaxs[di] ?? mk.refMax;
              const rng = rMax - rMin;
              return rng > 0 ? Math.round(((v - rMin) / rng) * 1000) / 10 : 50;
            })
          : abs,
      );
    }
    const allN: number[] = [];
    for (let si = 1; si < this.#data.length; si++)
      for (const v of this.#data[si]!) if (v != null) allN.push(v);
    if (normalized) {
      this.#allLo = Math.min(0, allN.length ? Math.min(...allN) : 0);
      this.#allHi = Math.max(100, allN.length ? Math.max(...allN) : 100);
    } else {
      this.#allLo = allN.length ? Math.min(...allN) : 0;
      this.#allHi = allN.length ? Math.max(...allN) : 1;
    }
    const ap = (this.#allHi - this.#allLo) * 0.06 + 1;
    this.#allLo -= ap;
    this.#allHi += ap;
  }

  #makeChart(): void {
    this.#buildData();
    // BEFORE the canvas guard: the footnote is DOM, not canvas, so it must also be
    // right in a DOM-only environment (SSR, happy-dom) where the plot never draws.
    this.#refreshWarnFoot();
    const m = this.#model!;
    const normalized = m.normalized !== false;
    const wrap = this.#root.querySelector<HTMLElement>(".chart-wrap")!;

    if (!canvasSupported()) {
      wrap.innerHTML = `<p class="muted">Chart needs a browser canvas to render.</p>`;
      return;
    }

    const th = theme();
    const bandCol = th.dark ? "rgba(46,204,113,0.10)" : "rgba(30,132,73,0.08)";
    const W = () => wrap.clientWidth || 920;

    const drawBand = (uu: uPlot) => {
      const ctx = uu.ctx,
        bb = uu.bbox;
      if (normalized) {
        const y0 = uu.valToPos(0, "pct", true);
        const y100 = uu.valToPos(100, "pct", true);
        ctx.save();
        ctx.fillStyle = bandCol;
        ctx.fillRect(bb.left, Math.min(y0, y100), bb.width, Math.abs(y100 - y0));
        ctx.restore();
      } else if (this.#used.length === 1) {
        // In absolute mode with 1 marker, shade the lab-specific reference band following each report's ref limits
        const rMins = this.#refMins[0] || [];
        const rMaxs = this.#refMaxs[0] || [];
        const validIdxs: number[] = [];
        for (let i = 0; i < this.#x.length; i++) {
          if (this.#abs[0]?.[i] != null && rMins[i] != null && rMaxs[i] != null) {
            validIdxs.push(i);
          }
        }
        if (validIdxs.length > 0) {
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i < validIdxs.length; i++) {
            const vi = validIdxs[i]!;
            const px = uu.valToPos(this.#x[vi]!, "x", true);
            const py = uu.valToPos(rMaxs[vi]!, "pct", true);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          for (let i = validIdxs.length - 1; i >= 0; i--) {
            const vi = validIdxs[i]!;
            const px = uu.valToPos(this.#x[vi]!, "x", true);
            const py = uu.valToPos(rMins[vi]!, "pct", true);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = bandCol;
          ctx.fill();

          ctx.strokeStyle = th.dark ? "rgba(46,204,113,0.35)" : "rgba(30,132,73,0.3)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    // band drawing lives in chart-kit; the component only supplies the event
    // list (model data) and the active set (its checkbox row)
    const drawEvents = eventBands({
      events: m.events ?? [],
      active: () => this.#activeEvents(),
      dark: th.dark,
    });

    // tooltip rows: actual value + unit, normalized % — the shell/date come from chart-kit
    const tipRows = (idx: number): string => {
      let rows = "";
      this.#used.forEach((mk, i) => {
        const a = this.#abs[i]![idx];
        if (a == null) return;
        const norm = this.#data[i + 1]![idx];
        const lab = this.#labs[i]?.[idx];
        const rMin = this.#refMins[i]?.[idx] ?? mk.refMin;
        const rMax = this.#refMaxs[i]?.[idx] ?? mk.refMax;
        const note =
          mk.goodAbove != null && a >= mk.goodAbove
            ? ` <span class="u-tip-ok">✓ ${esc(mk.goodNote || "optimal")}</span>`
            : "";
        // The tooltip is where the % is stated as a NUMBER — the most authoritative
        // form it ever takes. So this is exactly where a flagged marker must carry
        // its ⚠, right against the figure it is casting doubt on.
        const w = mk.warn ? `<span class="u-tip-warn" title="⚠">⚠</span> ` : "";
        const labNote = lab ? ` <span class="muted">· ${esc(lab)}</span>` : "";
        const refNote = rMax > rMin ? ` <span class="muted">(ref: ${fmtVal(rMin)}–${fmtVal(rMax)}${mk.unit ? " " + esc(mk.unit) : ""})</span>` : "";
        const pctNote = normalized
          ? ` <span class="muted">(${esc(norm)}%${mk.warn ? " ⚠" : ""})</span>`
          : "";
        rows +=
          `<div class="u-tip-row"><span class="u-tip-dot" style="background:${this.#colorFor(mk.key)}"></span>` +
          `${w}${esc(mk.label)}: <b>${fmtVal(a)}${mk.unit ? " " + esc(mk.unit) : ""}</b>` +
          `${pctNote}${refNote}${note}${labNote}</div>`;
      });
      return rows;
    };

    const series: uPlot.Series[] = [{}];
    this.#used.forEach((mk) => {
      series.push({
        label: mk.label,
        scale: "pct",
        stroke: this.#colorFor(mk.key),
        width: 1.5,
        // DASHED = "this line is drawn against a band we do not trust". A dashed line
        // reads as provisional in every chart convention there is, and — unlike a
        // colour or an opacity change — it survives greyscale, colour-blindness and a
        // phone screen in sunlight. It costs the marker none of its visibility: she
        // still sees the trend, she just cannot mistake it for a verdict.
        ...(mk.warn ? { dash: [5, 4] } : {}),
        spanGaps: true,
        paths: th.spline,
        points: { show: true, size: 4 },
        value: (_self: uPlot, _rv: number | null, si: number, di: number | null) => {
          if (di == null) return "--";
          const a = this.#abs[si - 1]![di];
          return a == null ? "--" : fmtVal(a) + (this.#used[si - 1]!.unit ? " " + this.#used[si - 1]!.unit : "");
        },
      });
    });

    if (this.#u) {
      this.#u.destroy();
      this.#u = null;
    }
    this.#u = new uPlot(
      {
        width: W(),
        height: 360,
        scales: { x: { time: true }, pct: {} },
        series,
        axes: [
          xAxis(th),
          { scale: "pct", stroke: th.axis, grid: { stroke: th.grid, width: 0.5 } },
        ],
        legend: { show: false },
        cursor: {
          drag: { x: false, y: false },
          // Default uPlot cursor behavior lets the crosshair (.u-cursor-x, and our
          // own tooltip position, which reads cursor.left) follow the raw mouse
          // pixel while the per-series hover points (.u-cursor-pt) and cursor.idx
          // independently snap to the nearest real data point. With this app's
          // sparse, irregularly-spaced lab draws the "nearest point" catchment can
          // be tens of pixels wide, so the two diverge: the tooltip's VALUES are
          // right (keyed off cursor.idx) but its POSITION visibly drifts from the
          // point it is describing. Snap the raw mouse itself to the nearest
          // point's pixel so every cursor.* consumer agrees.
          move: (self, mouseLeft, mouseTop) => {
            const xs = self.data[0] as number[] | undefined;
            if (mouseLeft < 0 || !xs || !xs.length) return [mouseLeft, mouseTop];
            // Bound the search to the currently VISIBLE index range (uPlot's own
            // series[0].idxs, kept in sync with the x scale by zoom/pan), not the
            // full data array. self.data[0] holds every point in the series
            // regardless of zoom; searching all of it let an edge hover snap to a
            // point outside the visible window -- e.g. an older draw scrolled off
            // to the left -- producing a wildly out-of-plot pixel (valToPos of a
            // value outside the current scale range) while uPlot's own cursor.idx
            // lookup (closestIdx(valAtPosX, data[0], i0, i1) in its source) stayed
            // correctly clamped to what's on screen, hiding the per-series points
            // (its mouseLeft1 < 0 guard) instead of matching our crosshair.
            const [i0, i1] = self.series[0]?.idxs ?? [0, xs.length - 1];
            if (i0 > i1) return [mouseLeft, mouseTop];
            const xVal = self.posToVal(mouseLeft, "x");
            let lo = i0;
            let hi = i1;
            while (lo < hi) {
              const mid = (lo + hi) >> 1;
              if (xs[mid]! < xVal) lo = mid + 1;
              else hi = mid;
            }
            let nearest = lo;
            if (lo > i0 && Math.abs(xVal - xs[lo - 1]!) <= Math.abs(xs[lo]! - xVal)) {
              nearest = lo - 1;
            }
            // canvasPixels omitted (defaults false): valToPos must return CSS-pixel
            // space to match mouseLeft/mouseTop, not device-pixel space -- passing
            // true here returns coordinates scaled by devicePixelRatio, which on a
            // >1 DPR screen pushes the snapped position outside the plot's CSS
            // bounds and makes uPlot mark the cursor "off" (hidden) instead of moved.
            const snappedLeft = self.valToPos(xs[nearest]!, "x");
            return [snappedLeft, mouseTop];
          },
        },
        hooks: {
          drawClear: [drawBand, drawEvents],
          setCursor: [(self: uPlot) => this.#showTip?.(self)],
        },
      },
      this.#data as uPlot.AlignedData,
      wrap,
    );
    // v3 ADDITION (medication lane, now rendered INSIDE the plot instead of as a
    // separate row above it): an anchor for the sibling medication-history lane,
    // inserted as the FIRST child of uPlot's own .u-wrap -- ahead of .u-under (the
    // canvas) in DOM order. None of uPlot's own layers set z-index, so paint order
    // here is plain DOM order, which is what keeps this slot's contents painting
    // behind the canvas's own pixels (grid, band fill, series strokes) wherever it
    // actually draws something. #makeChart() destroys and rebuilds .u-wrap on every
    // call (marker toggle included, not just #render()), so this anchor has to be
    // recreated here every time too, not once in #render()'s static template.
    const uwrap = wrap.querySelector<HTMLElement>(".u-wrap");
    if (uwrap) {
      const slot = document.createElement("div");
      slot.className = "med-lane-slot";
      slot.style.cssText = "position:absolute;inset:0;pointer-events:none;";
      uwrap.insertBefore(slot, uwrap.firstChild);
    }
    this.#showTip = tooltip(this.#u as never, tipRows, monthYear) as (self: uPlot) => void;
    this.#setPct = smoothScale(this.#u, "pct", { min: this.#allLo, max: this.#allHi });
    // #makeChart() only ever runs after #render() has called #makeNav(), so
    // #nav is always set by this point.
    this.#nav!.attachPan(this.#u.over);
    this.#nav!.apply();

    if (!this.#ro && typeof ResizeObserver !== "undefined") {
      this.#ro = new ResizeObserver(() => {
        if (this.#u) this.#u.setSize({ width: W(), height: 360 });
      });
      this.#ro.observe(wrap);
    }
  }

  // rebuild the chart without letting the uPlot teardown jump the page scroll
  #rebuildKeepScroll(): void {
    const sy = window.scrollY,
      sx = window.scrollX;
    this.#makeChart();
    window.scrollTo(sx, sy);
    requestAnimationFrame(() => window.scrollTo(sx, sy));
  }
}
