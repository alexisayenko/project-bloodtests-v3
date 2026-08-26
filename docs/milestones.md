# Milestones

Dated project events — launches, releases, public posts, evidence
artifacts. Newest first.

Starts as this flat file. Extracts to `milestones/` (with
`history.md` index + dated deep-dive files + evidence) when
events accumulate enough to warrant their own pages — see
[`README.md#section-file-folder`](README.md#section-file-folder).

## Events

- 2026-08-26 — Monitoring Panels grid cards and the "What's in range"
  chart (Panel Detail only) now also show each panel's computed
  indices, dot-colored by ok/warn/bad zone, below a divider; Panel
  Detail gained a back chevron (‹) before its title, back to the
  Monitoring Panels grid; not-taken chips show just the marker name
  (no "never taken" caption); the single-panel picker (Panel Detail)
  drops the bordered box/caption that multi-panel pickers (All
  Observations) still show.
- 2026-08-26 — Panel Detail and All Observations' "What's in range" tab
  built: a normalized-overlay time chart (every marker as % of its own
  reference range on one shared axis), v2's `<lab-explore>` component
  vendored as-is (`web/src/vendor/lab-explore/`, `web/src/vendor/chart-kit/`)
  and driven by a new `exploreModel.ts` adapter; generic-only scope (no
  medication overlays, reference-band overrides, or data-quality
  flagging).
- 2026-08-26 — Monitoring Panels grid restyled from pill/badge cards
  to list rows (status as a colored dot); breadcrumb navigation
  removed from Panel Detail and Reference Book; top nav reordered to
  Profile, Monitoring Panels, All Observations, Reference Book;
  Analysis table cells gain two-step click-to-open (arm, then open a
  result popup).
- 2026-08-26 — Deploy domain switched from `blood.isayenko.org` to
  `blood.isayenko.net`.
- 2026-08-25 — Quality baseline: page shell split into view
  components; 91-test vitest suite (v2 golden-masters ported); CI +
  SonarCloud (0 issues, quality gate green, 90.6% coverage of the
  logic layer) + Dependabot; eslint/Sonar/coverage all exclude the
  legacy unwired flow consistently.
- 2026-08-25 — Reference Book gains an HP Axis physiology page: the
  homepage-era HPG/prolactin explainer and HPT/HPG/HPA feedback-loop
  cascades, ported verbatim from v2's lens-common.
- 2026-08-25 — Reference Book built: a page per computed index with
  v2's full clinical prose (meaning + evidence standing) and cited
  sources with verbatim quotes; index popups deep-link into it.
- 2026-08-25 — All Observations section (all results, one table) and
  Profile data actions (Upload JSON / Generate Test Data / Clear,
  merging instead of replacing); short-label cleanup and de-duplicated
  popup headings; leptin LOINC corrected to 21365-2.
- 2026-08-25 — Monitoring Panels app built and deployed to
  `blood.isayenko.org`.
- 2026-08-25 — Computed indices (TC/HDL, HOMA-IR, calculated free
  testosterone, and 17 others) ported from `project-bloodtests-v2`.
- 2026-08-25 — Added a persistent app-wide nav (Reference Book,
  Monitoring Panels, Profile) and breadcrumb navigation.
