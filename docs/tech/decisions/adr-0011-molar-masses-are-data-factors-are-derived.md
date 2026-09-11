# ADR-0011: Molar masses are cited reference data; conversion factors are derived

Status: accepted · 2026-09-08

## Context

Mass↔molar conversion factors were written out by hand in three
places, and they had drifted.

`web/src/data/massMolarSiblings.ts` carried a `massPerMolarUnit` on
each of its 20 LOINC sibling pairs. `web/src/data/computedIndices.ts`
carried eight more, inherited from v2's `engine/src/convert.ts`, one of
them (testosterone ng/dL→nmol/L) declared twice under two names in the
same file. Every one of them was a bare number: no formula, no source,
no way to tell a rounding from a typo.

Two of those numbers were wrong, and nothing could have told us:

- Glucose's divisor was **18.018** in `computedIndices.ts` and
  **18.016** in `massMolarSiblings.ts`. Both files were live, both
  numbers were plausible, and the app disagreed with itself about what
  a mole of glucose weighs. From 180.156 g/mol it is **18.0156**.
- Triglyceride's factor was **88.57**, the figure online converters
  quote. It is not reproducible from triolein's molar mass under any
  published set of atomic weights, and no source for it could be found.
  The value derived from triolein is **88.545**.

The underlying problem is that a factor is an *answer*, not a fact. It
is a molar mass scaled by two unit prefixes, so it is correct only for
the unit pair it was computed for, it carries no trace of what produced
it, and the next unit pair needs a second hand-computed number that
nothing ties to the first. The analyte catalog had already been through
the same argument in a different costume
([ADR-0010](adr-0010-analyte-catalog-is-the-source-of-truth.md)):
facts that live in more than one place drift, and the fix is one place
that owns them plus derivation everywhere else.

## Decision

**The app tabulates molar masses as cited reference data, and derives
every conversion factor from them. No conversion factor is written by
hand anywhere.**

- `web/public/data/molar-masses.json` holds 17 analytes. Each entry
  carries the molecular `formula`, `molarMassGPerMol`, a `basis`, and
  the `sources` actually retrieved for it — a PubChem CID for a
  compound, the named CIAAW entry for an element — each stamped with
  the date it was fetched.
- **The mass is itself derived.** It is computed from the entry's
  formula and the CIAAW *Standard atomic weights 2021* table the file
  also carries, and the conformance suite recomputes it, so a mass
  cannot drift from the formula printed beside it. An element CIAAW
  publishes as an interval records the published interval verbatim in
  `publishedAs` next to the abridged conventional value used in the
  arithmetic.
- `web/src/data/molarMasses.ts` turns a mass into the factor a call
  site needs — `massPerMolarUnit(id, massUnit, molarUnit)` and its
  reciprocal — by scaling with the two units' decimal prefixes, and
  throws on a unit it does not fully understand rather than guessing.
  `massMolarSiblings.ts` now declares only `molarMass: '<id>'` per
  pair, and `computedIndices.ts` derives all eight of its constants.
- **`basis` records how true the number is**: `compound` (a single
  species, exact), `element` (an atomic weight), or `conventional`
  (no single true mass exists and practice agrees on a stand-in). The
  schema *requires* a `conventional` entry to carry a note saying what
  the convention is, and a test enforces it. Triglyceride is
  conventional because serum triglycerides are a mixture tabulated on
  the triolein equivalent; urea nitrogen is conventional because it is
  two nitrogen atoms rather than any molecule.
- `web/public/schema/molar-masses-1.schema.json` (draft 2020-12)
  describes the file, with **closed** objects for the same reason the
  analyte catalog's are closed: app-internal data with no outside
  authors, so a mistyped key should fail the suite rather than be
  ignored at runtime. `web/test/reference-data.test.ts` validates it,
  recomputes every mass, and requires each to agree with a cited
  source's own reported mass within 0.05%.

The full table, its citations and the conventional cases are in
[`../molar-masses.md`](../molar-masses.md).

## Alternatives considered

- **Keep the factors in TypeScript and add a test that they agree.**
  Cheapest, and it would have caught the glucose divergence. But
  agreement becomes a thing to maintain rather than a thing that
  cannot fail to hold, and it answers neither "where does the next
  factor go?" nor "where did this number come from?" — the triglyceride
  figure would have passed a consistency test forever.
- **Store the factors, but with a source field on each.** Attaches
  provenance without removing the duplication: cholesterol in
  mg/dL↔mmol/L and cholesterol in mg/L↔µmol/L would still be two rows
  citing one fact, and each unit pair the app later needs is another
  hand-computed number.
- **Compute masses at build time from a full periodic table
  dependency.** More general than needed. Ten elements cover every
  analyte here, and vendoring a table means vendoring somebody's choice
  of which CIAAW value to use — precisely the judgement this file makes
  explicit in `publishedAs` and `table`.
- **Trust PubChem's printed molecular weight as the stored mass.**
  PubChem prints four significant figures and computes on an older set
  of atomic weights, which is not enough precision for the smaller
  factors and hides which weights were used. It is kept as a
  **cross-check** instead: the source's own mass is recorded and the
  suite requires agreement within 0.05%, tight enough to catch a wrong
  formula or a transposed digit.
- **Put the masses on the analyte catalog entry (ADR-0010's file).**
  The catalog is keyed by LOINC, and a molar mass is not a fact about a
  code — total, HDL and LDL cholesterol are three codes and one
  molecule, and half the entries here back a computed index rather than
  a sibling pair. Keying by analyte id keeps one fact in one row.

## Consequences

- Re-deriving the constants re-baselined eight expected values in the
  computed-index golden masters, by at most **0.07% relative**. No
  value the UI displays at two decimal places changes. It is a
  constants correction, not a formula change, and the test file says so
  where the golds are declared.
- A new conversion is now a data edit — add the analyte with its
  formula and citation — rather than a number typed into a module. A
  new *unit pair* for an existing analyte is free.
- The chain from an IUPAC atomic weight to a number in a chart is
  auditable end to end, which is what makes a Reference Book page
  showing the arithmetic possible; `molarMassFromFormula` exists so
  such a page could show the working rather than assert the result.
- The `conventional` basis makes two approximations visible that were
  previously invisible, and puts the explanation on the entry instead
  of in a comment somewhere downstream. Two further entries —
  phosphate (both scales report elemental P) and direct bilirubin
  (conjugated bilirubin circulates as the glucuronide) — carry notes
  without the conventional basis, because the number is exact but what
  it is applied to is a convention.
- Nothing about conversion *behaviour* changes. A molar unit under a
  mass code is still a code error answered with the sibling code, never
  a rewritten value
  ([ADR-0003](adr-0003-store-only-what-the-lab-printed.md)); the
  factors remain data the app reports with and does not apply to stored
  rows.

## What would force revisiting

- An analyte whose conversion is not a molar mass at all — an enzyme
  activity, or an immunoassay unit defined against a WHO standard
  rather than a molecule. Those have no formula to compute from, and
  the file would need a second kind of entry rather than a seventeenth
  row.
- CIAAW republishing a weight this project uses, which is a data edit
  but would move the golden masters again and so wants the same
  re-baseline note.
- A consumer of this data outside the app — a converter, a build step —
  at which point the closed objects become a compatibility question,
  exactly as ADR-0010 already anticipates for the analyte catalog.

## Notes

- 2026-09-11: the Reference Book page shipped (`#reference/molar-masses`)
  printing each tabulated mass beside its formula rather than showing the
  working, so `molarMassFromFormula`'s only caller is still the
  conformance suite; nothing else changed.
