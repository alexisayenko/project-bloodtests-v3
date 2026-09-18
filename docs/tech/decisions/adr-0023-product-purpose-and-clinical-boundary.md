# ADR-0023: product purpose, audience, and clinical boundary

Status: accepted · 2026-09-18

## Context

The app had a working product — monitoring panels, computed indices,
LOINC validation, pathway diagrams — but no documented product
purpose, audience definition, or clinical boundary. The
`docs/product/README.md` and `docs/business/README.md` files carried
TODO placeholders for these sections. `CLAUDE.md` had accumulated a
rich technical description of *what* the product does, but not *why*
it exists or *who* it is for.

As the project approaches mobile design (task-0040) and broadens
from a personal tool toward a public audience, these questions need
settled answers: what is the product's purpose, who is it for, what
does it help them do, and — critically — where does its
responsibility end?

## Decision

**Paneloom's purpose is to help people make sense of their bloodwork
as a connected picture over time, so they can participate more
confidently in conversations with their doctor.**

Three pillars shape every feature:

- **Reduce complexity.** Make results, units, reference ranges, and
  terminology easier to navigate. Flag possible inconsistencies for
  review, without claiming the app can establish that a laboratory
  result is wrong.
- **Show the whole picture.** Connect related measurements and show
  how they change over time, keeping gaps and uncertainty visible.
  "Holistic view" means connecting the available evidence — not
  implying blood tests alone give a complete picture of someone's
  health.
- **Build understanding.** Explain what measurements represent and
  how they relate, helping people research, prepare questions, and
  understand the context of their doctor's recommendations. The
  Reference Book and pathway diagrams are central to this purpose.

**Learning approach:** users don't need to arrive with medical
knowledge, but understanding results involves learning. Paneloom
makes that learning approachable and connects it to the user's own
data — enough for a solid understanding without going into molecular
biology or biochemistry.

**Clinical boundary:** Paneloom supports understanding and
preparation; clinical interpretation and decisions about what to do
next belong with a qualified specialist. This is part of the
product's identity, not just a disclaimer — it shapes features (no
risk scores, no treatment suggestions) and wording throughout.

**Audience:** people who receive bloodwork results and want to
understand more than whether each number falls inside a reference
range. Primary audience today: the author and his family. Broader
audience: anyone who gets bloodwork done across multiple labs and
wants to own and understand the history themselves. Not designed
for clinicians, LIS systems, or automated health advice.

## Alternatives considered

- **Defer until the mobile app ships.** Rejected — without a
  documented purpose, every feature conversation re-argues first
  principles. The mobile concept (task-0040) specifically needs
  this to decide what the opening screen emphasizes.
- **Position as a diagnostic or advisory tool.** Rejected — the
  app lacks the clinical validation, regulatory standing, and
  liability posture to offer diagnosis. Staying on the
  "understanding" side of the line is a deliberate product choice,
  not just a legal hedge.

## Consequences

- `docs/product/README.md` and `docs/business/README.md` TODOs are
  filled with the agreed definition. New features are evaluated
  against the three pillars and the clinical boundary.
- Mobile design (task-0040) can use the purpose to decide what
  leads: an understandable overview and changes over time, with
  detailed evidence accessible underneath.
- The boundary shapes both features and copy. Wording like "consult
  a specialist" appears wherever the app surfaces computed or
  derived clinical figures.
- The audience definition does not exclude future expansion, but
  makes clear who the product is designed for *first*.

## What would force revisiting

- A decision to pursue clinical validation or regulatory
  classification (CE/FDA) — which would require the product to
  accept diagnostic responsibility.
- User research revealing that the primary audience wants
  actionable advice, not understanding — which would reopen the
  clinical boundary.
- A monetization decision that requires a different audience
  segmentation.
