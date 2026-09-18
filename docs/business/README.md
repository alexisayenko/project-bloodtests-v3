# Business

Audience, scope, monetization, and compliance posture —
decisions that apply to the project as a whole, not to a
specific product folder. For the product core idea and the
Concept / Feature / Screen vocabulary, see
[`../product/README.md`](../product/README.md). For cross-cutting
work-area axes (C1, C2, …), see [`../concerns.md`](../concerns.md).

## Audience

People who receive bloodwork results and want to understand more
than whether each number falls inside a reference range. They
shouldn't need to arrive with medical knowledge, but they are
willing to learn — the product makes that learning approachable
and connects it to their own data.

Primary audience today is the author and his family. The broader
audience is anyone who gets bloodwork done across multiple labs
and wants to own and understand the history themselves.

Not designed for: clinicians making treatment decisions, laboratory
information systems, or users seeking automated health advice.

## Scope (v1)

Web app only (browser-based, Cloudflare Worker deploy). No native
mobile app yet — mobile concept is under design
([task-0040](../tasks/task-0040.md)). No backend accounts required
for the core experience; optional cloud sync is under evaluation
(see ADR-0019).

## Monetization

- **Model**: undecided — explicitly left open, not "free" by
  design choice.
- **Free tier**: n/a (the entire product is currently free and
  open-source).
- **Paid tier**: n/a — no paid tier exists or is planned yet.
- **Price**: TBD pending audience growth and feature maturity.

## Non-goals (v1)

Things deliberately out of scope. Each line defends an absence.

- No clinical interpretation or treatment recommendations — we
  support understanding, not diagnosis (see product constraints).
- No community features (comments, ratings, UGC) — this is a
  personal record, not a social platform.
- No live data connections to laboratories or EHR systems — upload
  is manual and intentional.

## Open questions

- Monetization model — when and whether to introduce a paid tier.
- Cloud sync rollout — Supabase sign-in plus a GitHub-repo data store
  behind the Worker is decided (ADR-0019, ADR-0026) but not yet shipped
  to users; the email allowlist limits it to the owner until then.
- Mobile concept — navigation, opening screen, and historical-data
  comparison on narrow screens (task-0040).

## Resolved

Historical decisions with dates — load-bearing for understanding
why the current shape is what it is. Don't delete; the trail is
the audit.

- **Product purpose defined** (2026-09-18): three pillars (reduce
  complexity, show the whole picture, build understanding), clinical
  boundary, and learning approach agreed and documented in
  [`../product/README.md`](../product/README.md) and
  [ADR-0023](../tech/decisions/adr-0023-product-purpose-and-clinical-boundary.md).

## File layout

Scaffolded files:

- [`compliance.md`](compliance.md) — externally-imposed
  obligations (licensing, regulation, attribution, data
  residency).
- [`budget.md`](budget.md) — running ledger of out-of-pocket
  project costs (one-time + recurring).

Common slots — extract on first real entry. See
[Section, file, folder](../README.md#section-file-folder).

- `legal.md` — terms, privacy, jurisdictional notes.
- `marketing.md` — store listings, campaign copy, launch notes.
