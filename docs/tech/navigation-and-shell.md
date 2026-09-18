# Navigation and the app shell

## The shell

`web/src/components/conditions/MedicalConditionsPage.tsx` is the app shell:
route, results, shared settings and popup state. Each section is its own
sibling view component, every one a `React.lazy` import behind a
`<Suspense>`, so a route loads its code on first visit. Pure helpers sit
beside them in `markers.ts` / `routing.ts` / `ui.ts` / `resultsLookup.ts` /
`statusFilter.ts` / `reportDetailHelpers.ts`.

Persisted view settings (`unitSystem`, `sampleLimit`, `compactPanels`) live
in `bloodtests_view_settings_v1`, read and written by `ui.ts`'s
`loadViewSettings` / `saveViewSettings`, owned by the shell and carried
through Clear all data and the backup's `settings.json`. Per-view filters are
`useState` in the view and never stored.

## Sections, in nav order (`routing.ts`'s `NAV_ITEMS`)

| Hash | Section | Doc |
| --- | --- | --- |
| `#profile` | Get Started | below |
| `#reports`, `#reports/<file>` | Diagnostic Reports | [`diagnostic-reports.md`](diagnostic-reports.md) |
| `#all`, `#all/in-range`, `#all/trends` | All Observations | [`results-tables.md`](results-tables.md), [`charts.md`](charts.md) |
| `#panels` (default), `#panel/<id>` | Monitoring Panels | [`monitoring-panels.md`](monitoring-panels.md) |
| `#pathways` | Hormonal Pathways | [`pathway-pages.md`](pathway-pages.md) |
| `#lipids` | Lipid Transport | [`pathway-pages.md`](pathway-pages.md) |
| `#plan` | Scheduled Visits | [`scheduling-and-visits.md`](scheduling-and-visits.md) |
| `#medications` | Medications | [`medications.md`](medications.md) |
| `#reference`, `#reference/<key>` | Reference Book | [`reference-book.md`](reference-book.md) |
| `#account` | Account | [`account-and-sync.md`](account-and-sync.md) |

**Get Started** (`ProfileView.tsx`): app description, data-privacy statement
and evidence-grading note, "Import JSON" (replaces all stored sessions, as a
share-link import does), a "Go to Diagnostic Reports" pill, and a showcase
test dataset generator (`data/generateTestData.ts`: demo reports under their
own ids, medications, and one sample scheduled visit only when no visit
exists yet; opens `#all/in-range` when finished).

## Blocking while errors exist

While validation errors exist, Monitoring Panels, Hormonal Pathways, Lipid
Transport and All Observations are disabled in the nav and their routes
redirect to `#reports` — one rule, `routing.ts`'s `isRouteBlocked` (panels,
panel, pathways, lipids, all), which `isNavItemBlocked` also asks. Get
Started, Scheduled Visits, Medications, Reference Book and Account stay
reachable. The shell swaps the route during render, so the blocked view never
paints, and replaces the URL with `history.replaceState` in an effect, so a
redirect adds no history entry and Back cannot loop into it.

## App shell from 768px up

`AppShell.tsx`: a white top bar (`TopBar.tsx` — mark and wordmark linking to
Monitoring Panels; a lock and "Your data stays in this browser" when signed
out, a cloud-check icon and "Synced to your account" when signed in) over a
left sidebar (`SideNav.tsx`) listing all `NAV_ITEMS` with a line icon each —
`lucide-react`'s, except `customIcons.tsx`'s `PillIcon` (Medications) and
`PathwaysIcon` (Hormonal Pathways), drawn to the same stroke and size —
Account pinned to its foot above a « / » collapse toggle, and a three-line
tagline centered in the free space, hidden below a 760px viewport height.
The active item is a soft teal pill; active and blocked state come from
`isNavItemActive` / `isNavItemBlocked`.

The sidebar is `position: fixed` under the top bar and never scrolls;
`.mc-page` and the footer (`.mc-footer`) are offset by its width
(`--mc-sidebar-w`, 232px, 200px below 1024px) — fixed rather than sticky
because the footer sits outside the shell. The toggle collapses it to a 64px
icon rail (labels and tagline hidden, each item named by `aria-label` and a
tooltip): `AppShell` stamps `data-sidebar-collapsed` on the root element,
since the footer outside the shell reads the same width variable, and
`sidebarCollapsed.ts` keeps the choice under
`bloodtests_sidebar_collapsed_v1` (`"true"`, the key removed when expanded).

Phones keep the wrapping `NavBar` (brand mark plus the same labels) until
[task-0020](../tasks/task-0020.md) designs their shell; every slot stays in
place across the breakpoint so rotating a phone remounts nothing. `NavBar`
hides on scroll-down and returns on scroll-up (`useHideOnScroll.ts`),
publishing its height as `--mc-nav-h` / `--mc-nav-offset`. It deliberately
does not use `TabBar` — it differs in container, three-state colors, its
blocked / `not-allowed` state and route-derived active tab — and keeps
`ui.ts`'s inline `tabStyle` to itself.

## Shared components

- `PageHeader.tsx` — every section's landing banner: overline, two-tone
  title, description lines and up to three icon pillars (accepting either
  `lucide-react` or `customIcons.tsx` icons). Panel Detail, report detail and
  the Reference Book's sub-pages keep a plain `<h1>`.
- `TabBar.tsx` — the in-page tab strip Panel Detail, All Observations and
  Scheduled Visits render; its look in `index.css`'s `.mc-tabs` / `.mc-tab`.
- `ControlsBar`, `ResultTables`, `TableScroller`, `ScheduleHeader` —
  [`results-tables.md`](results-tables.md).
- `Popup.tsx`, `StatusFilterBar.tsx`, `Footer.tsx`.
- Primitives in `web/src/components/primitives/`: `Button` / `FileButton`,
  `Card` and `CardParts.tsx`'s `CardHeader` / `CardTitle` / `CardDescription`
  / `IconBadge` / `Overline` / `DangerCard`, `SectionTitle` / `EmptyState`,
  `StatusDot` / `StatusChip` / `StatusToggle`, `SwitchToggle`,
  `SegmentedControl`, `styles.ts`'s table, card-table and field styles and
  `tones.ts`'s `TONE_DOT` / `TONE_LABEL` — catalogued in
  [`../ui-ux/style-guide.md`](../ui-ux/style-guide.md).
- Design tokens: every design value is a custom property in
  `web/src/styles/index.css`'s `:root` — colour roles, the green / amber /
  red status set with `-text` and `-bg` companions, panel tints, type scale,
  radii, shadows, spacing — and `web/src/styles/tokens.ts` (`COLOR`, `TINT`,
  `FONT`, `RADIUS`, `SHADOW`, `SPACE`) hands them to inline styles as `var()`
  references.
- `data/months.ts` (`MONTH_LABELS`, `isMonthKey`, `monthKey`, `monthKeyOf`,
  `formatMonthYear`, `formatMonthFullYear`) — the one home of the ISO
  `YYYY-MM` month key and its labels.

## Archive

The pre-nav upload / panels / results flow lives in `archive/src/components/`
at the repo root — outside `web/`, so outside the TS build, Vite's module
graph, eslint, Sonar's `sonar.sources` and coverage by construction rather
than by exclusion list. Its shared chart types moved to
`web/src/components/analytics/types.ts` and the series palette to
`palette.ts`, so the live Charts tab has no dependency on the archive.
