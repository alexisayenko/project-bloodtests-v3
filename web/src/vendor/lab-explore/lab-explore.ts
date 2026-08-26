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
    this.#root.innerHTML =
      `<style>${UPLOT_CSS}${EXPLORE_STYLES}</style>` +
      // The view's own name. It is the first thing on the labs page — see
      // LabExploreModel.title for why it is a promise and not a label.
      (m.title ? `<h2 class="explore-title">${esc(m.title)}</h2>` : "") +
      `<p class="muted hpg-note">${m.intro ?? DEFAULT_INTRO}</p>` +
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
      `<div class="axis-caps"><span class="cap-left">${esc(this.#lbl("axisPct"))}</span></div>` +
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
    this.#makeChart();
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
    for (const k of Object.keys(m.markers)) add(m.markers[k]!.panel).push(k);
    // never-drawn markers ride in their own group box, so a group whose markers she
    // has ALL never had taken still appears — that group is the one worth reading.
    const nt = m.notTaken ?? [];
    const ntByPanel: Record<string, typeof nt> = {};
    for (const n of nt) {
      add(n.panel);
      (ntByPanel[n.panel] ??= []).push(n);
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
      b.textContent = this.#lbl("notTaken") ? `${n.label} · ${this.#lbl("notTaken")}` : n.label;
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
      // The multi-group picker (All Observations) never gets index markers in
      // the first place (see buildExploreModel's doc comment), so there is
      // nothing to split there — everything renders as one row, as before.
      // The single-group picker (Panel Detail) instead renders observations
      // first, then — only if the panel has any index markers/not-taken
      // indices — a divider and a second row of index badges below it.
      const obsKeys = box ? keys : keys.filter((k) => !isIndexKey(k));
      const idxKeys = box ? [] : keys.filter(isIndexKey);
      const obsNt = box ? nts : nts.filter((n) => !isIndexKey(n.key));
      const idxNt = box ? [] : nts.filter((n) => isIndexKey(n.key));

      const bb = document.createElement("div");
      bb.className = "picker-badges";
      for (const k of obsKeys) bb.appendChild(mkBadge(k));
      for (const n of obsNt) bb.appendChild(mkNotTaken(n));

      if (box) {
        box.appendChild(bb);
        picker.appendChild(box);
      } else {
        picker.appendChild(bb);
        if (idxKeys.length || idxNt.length) {
          const divider = document.createElement("div");
          divider.className = "picker-index-divider";
          picker.appendChild(divider);
          const ibb = document.createElement("div");
          ibb.className = "picker-badges";
          for (const k of idxKeys) ibb.appendChild(mkBadge(k));
          for (const n of idxNt) ibb.appendChild(mkNotTaken(n));
          picker.appendChild(ibb);
        }
      }
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
    this.#used = this.#sel
      .filter((k) => k in m.markers)
      .map((k) => ({ key: k, ...m.markers[k]! }));
    this.#abs = [];
    this.#data = [this.#x];
    for (const mk of this.#used) {
      const map: Record<string, number> = {};
      for (const p of mk.data) map[p[0]] = p[1];
      const abs = this.#gdates.map((d) => (d in map ? map[d]! : null));
      const rng = mk.refMax - mk.refMin;
      this.#abs.push(abs);
      this.#data.push(
        abs.map((v) => (v == null ? null : Math.round(((v - mk.refMin) / rng) * 1000) / 10)),
      );
    }
    const allN: number[] = [];
    for (let si = 1; si < this.#data.length; si++)
      for (const v of this.#data[si]!) if (v != null) allN.push(v);
    this.#allLo = Math.min(0, allN.length ? Math.min(...allN) : 0);
    this.#allHi = Math.max(100, allN.length ? Math.max(...allN) : 100);
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
      const y0 = uu.valToPos(0, "pct", true);
      const y100 = uu.valToPos(100, "pct", true);
      ctx.save();
      ctx.fillStyle = bandCol;
      ctx.fillRect(bb.left, Math.min(y0, y100), bb.width, Math.abs(y100 - y0));
      ctx.restore();
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
        const note =
          mk.goodAbove != null && a >= mk.goodAbove
            ? ` <span class="u-tip-ok">✓ ${esc(mk.goodNote || "optimal")}</span>`
            : "";
        // The tooltip is where the % is stated as a NUMBER — the most authoritative
        // form it ever takes. So this is exactly where a flagged marker must carry
        // its ⚠, right against the figure it is casting doubt on.
        const w = mk.warn ? `<span class="u-tip-warn" title="⚠">⚠</span> ` : "";
        rows +=
          `<div class="u-tip-row"><span class="u-tip-dot" style="background:${this.#colorFor(mk.key)}"></span>` +
          `${w}${esc(mk.label)}: <b>${esc(a)}${mk.unit ? " " + esc(mk.unit) : ""}</b> ` +
          `<span class="muted">(${esc(norm)}%${mk.warn ? " ⚠" : ""})</span>${note}</div>`;
      });
      return rows;
    };

    if (!this.#nav) {
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
          return a == null ? "--" : a + (this.#used[si - 1]!.unit ? " " + this.#used[si - 1]!.unit : "");
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
        cursor: { drag: { x: false, y: false } },
        hooks: {
          drawClear: [drawBand, drawEvents],
          setCursor: [(self: uPlot) => this.#showTip?.(self)],
        },
      },
      this.#data as uPlot.AlignedData,
      wrap,
    );
    this.#showTip = tooltip(this.#u as never, tipRows, monthYear) as (self: uPlot) => void;
    this.#setPct = smoothScale(this.#u, "pct", { min: this.#allLo, max: this.#allHi });
    this.#nav.attachPan(this.#u.over);
    this.#nav.apply();

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
