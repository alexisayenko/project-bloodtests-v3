# UI / UX

Screens (pages), the journeys that thread them, and the
cross-cutting style and performance rules they all live under.

## Folder map

```text
ui-ux/
├── README.md             # this file — UI section entry + glossary
├── style-guide.md        # visual + interaction standards
├── performance-guide.md  # end-to-end UX performance standards
├── screens/              # one file per screen (page) — where the user is
│   └── README.md         # entry: screens section
└── journeys.md           # one section per multi-screen path — the sequence
```

## Section-local glossary

- **Screen spec** — one file describing a single screen (page).
  Lives in [`screens/`](screens/). A screen hosts one or more
  product features and defines layout, navigation in/out, and
  page-specific behavior. A screen is *where the user is*; a
  feature is *what the user can do there* (lives in
  [`../product/features/`](../product/features/)).
- **Journey spec** — one section (or, once extracted, one file)
  describing a multi-screen path (onboarding, first-add → save,
  recovery flow). Lives in [`journeys.md`](journeys.md), extracts
  to `journeys/<journey>.md` when entries grow. A journey threads
  screens — names
  the entry point, the screens visited in order, branch
  conditions, and the exit / success state. The level above
  *screen* in the product chain (concept → feature → screen →
  journey).
- **Constraint** — a self-imposed UI/UX limit (interaction
  patterns we won't ship, accessibility floors, page-specific
  restrictions). Lives inline here or in the relevant screen
  spec. Distinct from *compliance* (externally imposed; lives
  in [`../business/compliance.md`](../business/compliance.md)).

## Standards

Two scaffolded reference docs — both define what the product
holds itself to and grow as the project's conventions
crystallize.

- [`style-guide.md`](style-guide.md) — visual + interaction
  standards. External refs (iOS HIG / Material 3 / WCAG 2.2)
  plus in-project conventions (color use, motion timings,
  popup dismissal, voice & copy).
- [`performance-guide.md`](performance-guide.md) — end-to-end
  UX performance standards. Metrics, thresholds, tools,
  cadence — framed as the chain (frontend ↔ backend ↔ db)
  felt at the user, not per-layer benchmarks.

## File structure

Screen and journey files are project-specific. Sections emerge
from what each screen or journey actually needs — a simple list
view has a different shape from a multi-mode builder; a linear
onboarding journey has a different shape from a branching
recovery flow. Don't impose a fixed skeleton.

The only convention: lead with the screen / journey name as
`# Title` and a one-line definition (where the user is, or what
path they're on), so a reader knows what they're looking at
without reading further.

```markdown
# <Screen or journey name>

One-line definition.

[screen- or journey-specific sections — pick what fits]
```

When a screen hosts features, cross-link into
[`../product/features/`](../product/features/). When a journey
threads screens, cross-link into [`screens/`](screens/) for each
step.

## Adding a new screen

1. A new screen (page) is being designed or built.
2. Create `screens/<screen-name>.md` (kebab-case).
3. Cross-link the features the screen hosts.

## Adding a new journey

1. A multi-screen flow earns its own spec (multiple screens, a
   branch condition, or a meaningful entry/exit pair).
2. Add a `## <Journey name>` section in
   [`journeys.md`](journeys.md) (or, if journeys have already
   been extracted, create `journeys/<journey-name>.md` in
   kebab-case).
3. List screens in order, branch conditions, exit state.
4. Cross-link the screens it threads.
