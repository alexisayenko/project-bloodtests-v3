# ADR-0013: `U` and `IU` are one unit only where the analyte's LOINC property says so

Status: accepted · 2026-09-09

Qualifies [ADR-0007](adr-0007-ucum-as-the-unit-vocabulary.md)'s adoption
of UCUM: the vocabulary stays UCUM, and one of its commensurability
rules is deliberately not applied when comparing two spellings printed
for the same analyte.

## Context

A results row carries one unit label above it when every reading in it
is on the same scale, and a label on every cell when they are not
(`sharedUnit` in `web/src/components/conditions/ui.ts`, over
`unitNormalization`'s `sameUnitScale`). That test is
arithmetic: same kinds of quantity in the same order, and a ratio of
exactly one. `uIU/mL` and `mIU/L` pass it, `mg/dL` and `mmol/L` do not.

One pair of spellings does not answer to arithmetic at all. Labs print
both `U` and `IU`, and UCUM keeps them strictly apart, for good reason:

- `U` is *defined* — exactly 1 µmol/min, the enzyme unit the IUB fixed
  in 1964. It is a catalytic activity, commensurable with any other.
- `[IU]` is declared **arbitrary** in [UCUM's §§24–25](https://ucum.org/ucum),
  and arbitrary units are commensurable with *nothing at all* — not
  even with another `[IU]`. That is not an omission. The WHO fixes each
  International Unit against its own reference preparation of its own
  substance ([WHO TRS 932 Annex 2](https://cdn.who.int/media/docs/default-source/biologicals/documents/trs932annex-2-inter-biol-standards-rev2004.pdf)),
  so FSH's IU and hCG's IU are unrelated quantities that happen to share
  a name, and no conversion between them exists to be written down.

At the level UCUM works at — a unit expression, standing alone — that
refusal is correct and there is nothing to add to it.

The refusal is nonetheless wrong for a results row, because a results
row is never a unit standing alone. The owner's insulin history (LOINC
`20448-7`) is printed `µU/mL` nine times and `µIU/mL` five times, by one
lab, over one decade. Insulin is measured against a WHO preparation;
there is no micromole-per-minute reading of insulin anywhere in the
data, and could not be. Read literally, UCUM splits those fourteen
readings into two scales and the row loses its label — a row of
identical measurements, labelled cell by cell, to protect a distinction
that does not exist for insulin. The same thing happens in the other
direction to the enzymes: a lab printing `IU/L` for ALT is writing the
1964 enzyme unit with a habit of typography, which is why
[Clinical Chemistry's instructions to authors](https://academic.oup.com/clinchem/pages/General_Instructions)
tell authors to drop the "I".

What the string cannot say, the analyte can. LOINC records a Kind of
Property for every code ([Users' Guide §2.3](https://loinc.org/kb/users-guide/major-parts-of-a-loinc-term/property)),
and it is that property, not the spelling, that says which of the two
arbitrary units an analyte is measured in.

## Decision

**`U` and `[IU]` are the same base for one analyte whose LOINC property
names one of them, and different bases everywhere else.** The permission
is a property of the analyte, asked of the analyte catalog, and is
derived from the catalog's own long common names rather than from a
hand-kept list of codes ([ADR-0010](adr-0010-analyte-catalog-is-the-source-of-truth.md)).

Two properties grant it, for opposite reasons — which is why one flag
would not do and the reason is recorded with the code:

- **`catalytic-activity`** — `[Enzymatic activity/volume]` and its
  relatives, 8 codes today (ALT, AST, ALP, GGT, amylase, lipase,
  cholinesterase, CK). The unit is the 1964 enzyme unit, whose name is
  `U`, so a printed `IU/L` *is* `U/L`.
- **`arbitrary-unit`** — `[Units/volume]`, 12 codes today (insulin, TSH,
  FSH, LH, prolactin, thyroglobulin, anti-TPO, TRAb, anti-CCP,
  rheumatoid factor, antithrombin activity, oxLDL). The unit is the
  International Unit, whose name is `IU`, so a printed `µU/mL` *is*
  `µIU/mL`.

Under any other property the two stay apart, and **when no analyte is
supplied the answer is the conservative one** — a caller comparing two
bare strings can never fold them by accident.

**One analyte's `IU` never meets another's.** The fold is within one
code's own history of spellings; nothing here relates FSH's IU to hCG's,
which is the distinction UCUM exists to protect and it survives intact.

Implementation: `propertyOf` / `U_IU_FOLD_REASON` / `loincsFoldingUAndIu`
in `web/src/data/analyteCatalog.ts`, read by `foldsUAndIu` in
`web/src/data/unitNormalization.ts` and acted on in `sameUnitScale(a, b,
loinc?)` and `convertValue`; threaded from `buildRowCells` through
`sharedUnit` in `web/src/components/conditions/ui.ts`. The reasoning is
set out for the reader on the Reference Book's "Units and how they are
read" page, with the same sources cited.

## Why deviating from UCUM here is sound

- **The deviation adds context UCUM cannot have.** UCUM answers about
  unit expressions; it is not given an analyte, so "commensurable with
  nothing" is the only safe answer available to it. This app is given
  one, and the analyte settles the question the expression cannot.
- **It is narrow by construction.** Two properties, both derived from
  data, and no answer at all without an analyte. A code whose property
  is neither is simply absent from the map.
- **It is safe because only a label is at stake.** Nothing is converted
  by this path: the numbers on screen are the numbers the labs printed,
  and the worst a mistake could do is put one redundant label above a
  row instead of a label on each cell. No stored value is rewritten and
  no derived value is exported ([ADR-0003](adr-0003-store-only-what-the-lab-printed.md)).
  Where `convertValue` consults the same permission, the factor it
  applies is the decimal prefix (`µIU/mL` → `mIU/L`); no exchange rate
  between two arbitrary units is ever invented, because none exists.
- **It cannot drift.** The two sets are computed from the long common
  names already in `analyses.json`, so a code added tomorrow joins the
  right set, or neither, with nothing to update by hand.

## Alternatives considered

- **Follow UCUM literally.** Correct at the vocabulary level and wrong
  on the screen: the insulin row loses its label to a distinction that
  does not exist for insulin, and the enzymes lose theirs to a
  typographic habit. The user is shown fourteen identical measurements
  as if they were two kinds of thing.
- **Fold `U` and `IU` unconditionally.** Cheap, and it asserts an
  identity that is false in general — `U` is a defined micromole per
  minute and `[IU]` is whatever the WHO's preparation says it is. It
  would also fold across analytes, which is the one thing UCUM's rule
  is genuinely protecting.
- **A hand-kept list of the codes that may fold.** It is exactly the
  drift ADR-0010 was written against: the same fact stated twice, in the
  catalog and in a TypeScript array, with nothing to keep them agreeing.
- **Convert the values instead of the labels.** There is nothing to
  convert. Both directions are identities, not conversions, and touching
  a printed value would cross ADR-0003 for no gain.
- **Ask the printed unit's own spelling** (treat a bare `U` as the
  enzyme unit, `IU` as the WHO unit). That is precisely the assumption
  the data contradicts: the spellings are the unreliable part.

## Consequences

- A history printed in both spellings carries one row label — the
  insulin case that prompted this, and the enzymes reciprocally.
- `sameUnitScale` gained an optional third parameter. A caller that has
  an analyte should pass it; a caller grouping units across the whole
  catalog has no single analyte to name and correctly gets the
  conservative answer.
- The two sets have no fixed size: they are whatever the catalog's
  properties say, 8 and 12 today. Counts stated in prose (here, and on
  the Reference Book page, which computes them) are a snapshot.
- A long common name with no bracketed property yields no fold, so an
  analyte added without one silently gets the conservative behaviour
  rather than a wrong one.

## What would force revisiting

- An analyte legitimately measured in *both* arbitrary units — which
  would break the premise the whole rule rests on, that the analyte
  disambiguates, and would mean the permission has to come from
  something finer than the property.
- Adopting the NLM UCUM parser ([task-0008](../../tasks/task-0008.md)),
  which will answer commensurability questions itself. Its answer for
  this pair will be UCUM's, so this deviation would have to be applied
  as a layer over it rather than inside the scale arithmetic.
- LOINC changing how it files these properties, which is where both sets
  come from.
