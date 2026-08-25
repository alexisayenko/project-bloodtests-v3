# Screens

One file per screen (page) — where the user is. A screen hosts
one or more product features and defines layout, navigation in /
out, and page-specific behavior.

For the screen concept and its place in the chain (concept →
feature → screen → journey), see [`../README.md`](../README.md).

## File layout

```text
screens/
├── README.md             # this file
└── <screen-name>.md      # one per screen, kebab-case
```

## Adding a new screen

1. A new screen (page) is being designed or built.
2. Create `<screen-name>.md` (kebab-case).
3. Lead with `# <Screen name>` + one-line definition.
4. Cross-link the features the screen hosts
   ([`../../product/features/`](../../product/features/)).
5. Cross-link from any journey that threads through it
   ([`../journeys.md`](../journeys.md)).
