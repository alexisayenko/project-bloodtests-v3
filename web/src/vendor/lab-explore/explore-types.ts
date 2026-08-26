/**
 * The view-model `<lab-explore>` renders — markers overlaid on one time chart,
 * each normalized to % of its reference range. Ported from the homepage
 * `explore.njk` / natalga `labs.html` twins (ADR-0010); built from a
 * LabMatrixModel via `exploreFromLabs()` or assembled by hand.
 */

/** One plottable marker: a named series + the band it is normalized against. */
export interface ExploreMarker {
  /** badge/legend/tooltip label (short name preferred) */
  label: string;
  unit?: string;
  /** band the series normalizes to: value → (v - refMin) / (refMax - refMin) × 100 % */
  refMin: number;
  refMax: number;
  /**
   * picker group(s). Usually one panel, but a marker genuinely belonging to
   * more than one (e.g. Albumin under both Fatty Liver and Kidney Function)
   * takes the array form -- same key, same plotted series, one badge
   * rendered per group #buildPicker() adds it to (see lab-explore.ts).
   *
   * v3 DEVIATION from the v2 source: v2's panel was always exactly one
   * string, because v2 never had a marker that legitimately belonged to more
   * than one group. v3's panel definitions do allow that (see markers.ts's
   * PANEL_DEFS), and the Monitoring Panels grid already reflects it by
   * listing such a marker on every one of its panel cards -- so the
   * cross-panel All Observations picker needed a way to match that instead
   * of silently picking one "winning" panel. Single-panel contexts (Panel
   * Detail) still only ever produce the plain-string form.
   */
  panel: string | string[];
  /** at/above this raw value the tooltip adds a ✓ note (e.g. HDL-C ≥ 60) */
  goodAbove?: number | null;
  goodNote?: string | null;
  /** readings as ["YYYY-MM-DD", value] */
  data: [string, number][];
  /**
   * ⚠ — THE BAND ITSELF IS NOT TRUSTWORTHY. Propagated from the row's
   * `provenance.dataQuality` (unsourced range, or a range authored for the other
   * sex) or from `unreliable` (a bad assay).
   *
   * This flag exists because of what normalization DOES: it turns every marker
   * into a confident-looking "% of its own reference range", and a percentage of
   * a range we do not trust is a confident-looking lie. The whole view is named
   * after a promise — "what's in range, what isn't" — so a marker whose range is
   * wrong must be visibly disqualified from answering that question, not quietly
   * folded in with the honest ones. `<lab-explore>` marks it in the badge, dashes
   * its line, flags its tooltip row, and names it in a footnote under the chart.
   */
  warn?: boolean;
}

/**
 * A marker that is DECLARED but has never been drawn — no value at all, so
 * nothing to plot and nothing to normalize.
 *
 * It must still be NAMED. Dropping it would be the chart quietly saying "this
 * marker does not exist", when the truth is "this marker exists and you have
 * never had it taken" — which is exactly the one worth knowing, because it is the
 * one she could go and ask for. And it must NOT be plotted, because the only
 * value we could invent for it is 0 %, which would read as catastrophically low.
 * So: shown in the picker, named, and unselectable.
 */
export interface ExploreNotTaken {
  key: string;
  label: string;
  /** picker group(s) it belongs to (same axis and same v3 DEVIATION as ExploreMarker.panel) */
  panel: string | string[];
  /**
   * v3 ADDITION, not part of the ported v2 shape. Distinguishes "genuinely
   * never drawn" (the case above) from a SECOND, unrelated reason a marker
   * can land in this same disabled-chip list: it exists and HAS real dated
   * readings on file, but none of them can be normalized to this chart's
   * 0-100%-of-range band (e.g. every reading only ever printed a lower
   * reference bound -- HDL-C's "> 40 mg/dL" -- never an upper one, so there
   * is nothing to normalize against).
   *
   * Both cases render as the same disabled `.nodata` chip, and collapsing
   * them into one indistinguishable grey chip would be exactly the silent
   * "this marker does not exist" lie the doc comment above warns against --
   * worse here, since real values genuinely ARE on file. When set, the chip
   * appends this as a short suffix (and mirrors it as its title/tooltip) so
   * the two cases read as different stories, not the same one. Left unset
   * for the plain never-drawn case, which needs no explanation.
   */
  reason?: string;
}

/** UI strings for the chart's own chrome. Absent → English defaults. */
export interface ExploreLabels {
  /** chip on a never-drawn marker in the picker (e.g. «не сдавалось») */
  notTaken?: string;
  /** the ⚠ footnote sentence — why a flagged marker's % cannot be taken at face value */
  dataQuality?: string;
  /** y-axis caption (default "% of reference range") */
  axisPct?: string;
  /** label of the event-overlay checkbox row (default "Events:") */
  events?: string;
  /** label of the autoscale checkbox (default "Autoscale vertical") */
  autoscale?: string;
  /** accessible name of the panel select/deselect-all caption button */
  panelToggle?: string;
}

/** One period of a treatment/event band. `end: null` = ongoing (band follows the visible right edge). */
export interface ExplorePeriod {
  start: string;
  end: string | null;
  /** per-period label (e.g. dose); falls back to the event label */
  label?: string;
}

/** A toggleable shaded event overlay (medication course, intervention, …). */
export interface ExploreEvent {
  id: string;
  label: string;
  /** band fill */
  color: string;
  /** label text color, light / dark scheme */
  text: string;
  textDark?: string;
  periods: ExplorePeriod[];
  /** checkbox state before any persisted choice exists (default false) */
  defaultOn?: boolean;
}

export interface ExploreZoomStep {
  label: string;
  days: number;
}

/** localStorage keys; defaults keep continuity with the pre-component pages. */
export interface ExplorePersistKeys {
  sel?: string; // default "exploreSel"
  view?: string; // default "hpgChartView"
  autoscale?: string; // default "hpgAutoscale"
  evPrefix?: string; // default "exploreEv:"
}

export interface LabExploreModel {
  markers: Record<string, ExploreMarker>;
  /** keys selected when nothing is persisted yet */
  defaultSelection?: string[];
  events?: ExploreEvent[];
  /** zoom stops; defaults to 6 m … 10 y like the reference implementation */
  steps?: ExploreZoomStep[];
  defaultStepIdx?: number;
  overscroll?: number;
  intro?: string;
  /**
   * Heading over the chart — the view's OWN NAME, and on natalga.com that name is
   * «Что в норме, а что нет».
   *
   * WHY THAT NAME (this rename is deliberate; do not "fix" it back to «Обзор» /
   * "Explore"): a view's name should say what the reader GETS, not how the view
   * works. "Explore"/«Обзор» describes the machinery — you may browse around in
   * here. Normalizing every marker to 0–100 % of its own reference range is not a
   * gimmick, it is precisely what buys comparability against each marker's own
   * limits: one glance, one axis, and "inside the band / outside the band" reads
   * the same for TSH as for ferritin. So the honest name for the view is the
   * promise that normalization makes — and it is a promise, which is why
   * ExploreMarker.warn exists to keep it (see above).
   */
  title?: string;
  labels?: ExploreLabels;
  /** declared-but-never-drawn markers — named in the picker, never plotted */
  notTaken?: ExploreNotTaken[];
  persist?: ExplorePersistKeys;
}
