# CLAUDE.md

Fast-path context for Claude Code. Full human-oriented docs:
[docs/](docs/).

## Key principle

> [TODO: one-line principle that governs every product decision]

[TODO: one paragraph elaborating how this principle applies — what
decisions are weighed against it, what gets cut when it doesn't
reinforce the principle.]

## Product

[TODO: one paragraph — what it is, who uses it, mechanic,
monetization.]

## Tech stack

React 19 + TypeScript + Vite, in `web/`. No backend — panel/analyte
reference data ships as static JSON (`web/public/data/`), uploaded lab
results are parsed client-side and kept in `localStorage`. Deploys as
a Cloudflare Worker (static assets) to `blood.isayenko.org` via
`web/wrangler.jsonc`; deploy is manual (`wrangler deploy`), not CI-triggered.
Current entry view is the Monitoring Panels screen
(`web/src/components/conditions/MedicalConditionsPage.tsx`); the
original upload/panels/results/analytics flow still exists in
`web/src/components/` but isn't currently wired into `App.tsx`.

## Repo

[project-bloodtests-v3](https://github.com/alexisayenko/project-bloodtests-v3)
(private). Remote via SSH (`git@github.com:...`).

## Where to look for more

- [README.md](README.md) — repo entry point + structure
- [docs/README.md](docs/README.md) — docs subtree map
- [docs/product/concepts/](docs/product/concepts/) — observation, monitoring
  panel, lab report, computed index
