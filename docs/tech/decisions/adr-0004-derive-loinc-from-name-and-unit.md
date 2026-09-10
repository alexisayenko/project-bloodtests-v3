# ADR-0004: derive LOINC from printed name + unit, demote printed codes to evidence

Status: accepted · 2026-08-28

## Context

Observations enter the app through a chatbot that transcribes lab
reports into the interchange JSON. The prompt used to allow the
chatbot to *supply* LOINC codes from its own knowledge when the
report printed none, "with high confidence".

Chatbots hallucinate plausible-but-wrong codes, and a wrong code
is far worse than a blank one: it silently files a result under a
different analyte. Real cases from imported reports:

- Free T3 given **3016-3** — Thyrotropin's (TSH's) code.
- HDL Cholesterol given **2089-1** — LDL's code.
- MCV and MCH with each other's codes (787-2 / 785-6 swapped).

Each looked perfectly valid — right shape, right domain — so the
existing cross-check (which trusted the code and only compared the
printed name against the code's catalog name) could miss them
whenever the names shared a token, and could not say which code
was right.

Meanwhile the app already holds everything needed to identify the
analyte itself: the printed name, the printed unit, the analyte
catalog (with per-language translations), and a curated
unit-per-code table (`SHORT_LABELS` + `ALSO_REFS`) that separates
unit variants of one analyte (Prolactin mIU/L 15081-3 vs ng/mL
2842-3).

## Decision

**The app derives each observation's LOINC from the printed name +
unit, deterministically. A code printed on the report (or present
in the upload) is corroborating evidence only — verified against
the derivation, never blindly trusted. Chatbots never supply codes
from their own knowledge.**

The resolver ladder (`resolveLoinc` in `loincCheck.ts`):

1. Latin part of the printed name against catalog English names,
   IDF-weighted, unit-aware: a candidate whose known unit agrees
   with the row's is boosted, one whose known unit contradicts it
   is heavily penalized — so the unit hard-selects among unit
   variants of one analyte.
2. Failing that, the full printed name (non-Latin scripts kept)
   against catalog `lang` translations, same unit selection.
3. The explicit opt-in NLM online lookup stays a separate stage;
   its name-search results now carry `EXAMPLE_UCUM_UNITS` and get
   the same unit selection.

The result carries `confident: boolean` — true only when the top
candidate clearly dominates (score threshold + dominance gap +
consistent unit). Cross-check per row: derived == printed code →
match; a confident derivation disagreeing with the printed code →
mismatch, with the derived code offered (and one-click applicable
through the normal edit-draft path); no confident derivation →
fall back to name-overlap against the printed code's own catalog
entry, as before.

The chatbot prompt transcribes a code only when the report prints
one (and only if LOINC-shaped); otherwise `loinc` is `""`.

*Update 2026-08-31:* the unit table is no longer strictly
one-unit-per-code — `ALLOWED_UNITS` accepts extra units per code
where LOINC fixes the quantity kind but not the scale (Estradiol
1848-1 pg/mL alongside the curated primary), and
`SUPPLEMENTARY_UNITS` supplies units for catalog analytes outside
the curated table. The cross-check also collapses members of one
alias group: a printed code that is an alias of the confidently
derived code counts as a match, and alias-group members merge into
one suggestion whose kept code is chosen by the row's unit
(same-scale groups fall back to the primary).

*Update 2026-09-10:* a candidate whose known units all measure a
different dimension than the row's printed unit is no longer
penalized but dropped before either stage ranks (hemoglobin in g/L is
never offered HbA1c's %); a different scale of the same dimension
still only adjusts the score. A printed code that is already the top
candidate counts as a match even without confidence, and the
name-overlap fallback also accepts the code's display, badge or
ru-RU/uk-UA name, so a Cyrillic printout is no longer compared by an
empty Latin part. The validation unit warning no longer reads the
allowed-unit sets directly; it fires on a dimension contradiction only.

## Consequences

- Codes the report never printed now arrive blank and get filled
  by the resolver — deterministic and reviewable, instead of
  baked invisibly into the upload by a language model.
- The resolver is only as good as the catalog and the curated
  unit table; an analyte missing from either can't be derived
  and falls back to the old name-overlap check or NLM.
- A confident-but-wrong derivation is now possible where two
  analytes share name tokens and units; the dominance gap and the
  chip/Apply flow (user confirms, Save gates persistence) bound
  the damage.
- Printed codes keep their provenance value: they are stored as
  printed (ADR-0003) and flagged, never silently rewritten.

## What would force revisiting

- A lab feed that prints authoritative LOINCs routinely
  contradicted by the resolver — evidence the derivation, not the
  print, is the weaker signal in practice.
- Catalog growth to the point where name+unit no longer
  discriminates (many same-name, same-unit analytes), demanding
  specimen/method awareness the format doesn't carry.
