# Unit

The measurement scale a result is expressed in — `mmol/L`, `10^9/L`, `ng/mL` — recorded per entry in a [diagnostic report](lab-report.md), not fixed by the [observation](observation.md).

> **Status: partly built.** The printed unit described below is still the only unit the app *stores*. Deriving a canonical UCUM unit from it now exists — as a pure module, computing on demand and writing nothing — and it runs at import, over every observation of every import route, attaching the derived pair beside the printed one in memory. What it cannot settle it reports as a warning; what does not exist is the place a person confirms a suggestion. The vocabulary was decided 2026-09-07 ([ADR-0007](../../tech/decisions/adr-0007-ucum-as-the-unit-vocabulary.md)).

## What a unit is today

Provenance. The app stores each observation's `unit` exactly as the lab printed it and rewrites it never — same rule that governs every other field a report carries. A result that came back as `mmol/l` stays `mmol/l`; one that came back as `mmol/L` stays `mmol/L`.

One helper does fold spellings today, and it is worth being exact about its reach: `canonicalUnit` in `web/src/data/loincCheck.ts` transliterates a Cyrillic unit, folds superscript digits, the micro sign and the multiplication sign (all borrowed from the normalization module rather than tabulated twice), lowercases the result, and folds a per-mL prefix up to its per-L equivalent (`µIU/mL` → `miu/l`). It exists so the LOINC cross-check can compare a row's unit against a code's allowed set. It is a **matching key only** — it never touches stored data, is never displayed, and is not UCUM.

One display rule follows from a unit being per-result rather than per-observation: **a number and its unit label always move together.** A table row groups a code with its unit variants, and those variants are by definition on different scales, so the row's label cannot speak for every cell under it. Each reading is labelled with its own code's unit; a row whose readings disagree drops its row-level unit and labels each cell instead. Only a verified conversion may change a number, and then the label changes with it. Anything else prints one lab's figure under another lab's scale, which is the same mislabel a wrong code is.

The consequence is that a unit is a *string*, not a scale. Two labs measuring the same thing on the same scale can disagree on how to spell it, and across years and languages they routinely do: `10^9/L`, `×10⁹/л`, `10*9/L`, `G/L`. To the app these are four different units.

## Printed unit versus canonical unit

Two distinct things, and the distinction is the whole point of this page:

- **Printed unit** — what appeared on the paper. Evidence. Varies by lab, by year, by language, by typography. Never rewritten.
- **Canonical unit** — a [UCUM](https://unitsofmeasure.org) code identifying the scale itself, independent of spelling. Derived, comparable, machine-readable. All four spellings above map to one canonical code.

UCUM as the target vocabulary is settled in [ADR-0007](../../tech/decisions/adr-0007-ucum-as-the-unit-vocabulary.md).

## Why the distinction matters

- **Cross-year comparison.** Charting a marker over a decade means charting results from several labs. If `mmol/l` and `mmol/L` are different units, the series either splits or silently plots incomparable points. Comparison needs a scale, and only the canonical unit is one.
- **SI/US conversion.** Converting Glucose between `mmol/L` and `mg/dL` is a factor keyed off the scale. Keying it off printed strings means maintaining a factor per spelling — an open-ended list that fails on the first spelling nobody anticipated. Keyed off the canonical unit, it's one factor per pair of scales.
- **LOINC alignment.** LOINC publishes example UCUM units per code. A canonical unit can be checked against them; a printed string can only be string-matched against a hand-kept list.

## Deriving the scale from the string

That is what the normalization module in `web/src/data/unitNormalization.ts` answers, and the shape of the answer is the point: it **derives**, it does not rewrite. Given a printed unit it produces a canonical Latin spelling, then a UCUM code, then a judgement on whether that code's dimension fits the observation's LOINC. Every function is pure, nothing is stored, and a unit it cannot place returns nothing rather than a guess — a flagged row, not a wrong one.

Two consequences worth stating at concept level, because they are choices and not implementation detail:

- **The tables are curated, not a parser.** UCUM is an expression grammar; a valid unit can be written that no lookup table anticipated. Covering the units this app's labs actually print — including their Cyrillic and Ukrainian spellings, where Ukrainian `МО` and Russian `МЕ` are the same international unit — is a smaller and more honest promise than claiming UCUM support. Adopting the National Library of Medicine's UCUM library remains the upgrade path ([task-0008](../../tasks/task-0008.md)).
- **A derived number is for comparability, never for correction.** A conversion between two scales of one analyte exists (`convertValue`), and it is there so a decade of results that mixes `mg/dL` and `mmol/L` can be charted as one series — which is now what the "What's in range" chart does, placing every reading on the unit its reference band is expressed in. It is never a way to make a bad row look good: the conversion reaches a chart series and nothing else, the stored row keeps what the lab printed, and a unit that contradicts its code still raises the same warning it did before it was plotted.

## A wrong unit is often a wrong code

The sharpest case is not a spelling at all. A lab reports cholesterol in `mmol/L` and the file carries `2093-3`, the `[Mass/volume]` code: a substance-per-volume number under a mass-per-volume code. Nothing about the number is wrong — the *code* is, and LOINC already publishes the right one, `14647-2`, the same analyte on the molar scale.

So the remedy is the sibling code, never a converted value. Rewriting the number would invent a figure no lab printed, which the format rules out on principle ([ADR-0003](../../tech/decisions/adr-0003-store-only-what-the-lab-printed.md)). `web/src/data/massMolarSiblings.ts` holds the curated pairs — 21 analytes where labs routinely differ: cholesterol and its fractions, triglyceride, glucose, creatinine, urea and urea nitrogen, the bilirubins, urate, calcium, magnesium, phosphate, iron, testosterone, cortisol, free T4 — each with the mass-per-molar-unit factor recorded as *data*, never applied to a stored or exported number.

That factor is not typed out, and this is the second half of the same principle. A pair names its analyte's entry in `web/public/data/molar-masses.json` — a molar mass with the formula it was computed from, the CIAAW atomic weights behind it, and a retrieved citation — and the factor is derived from that mass and the pair's two units ([ADR-0011](../../tech/decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)). A printed value is provenance and a conversion factor is a derivation, and the file records which of its numbers are exact and which are conventions the field agrees on: triglycerides are a mixture tabulated on the triolein equivalent, and urea nitrogen is an atom count rather than a molecule. The table, its citations and the conventional cases are in [`docs/tech/molar-masses.md`](../../tech/molar-masses.md).

The catalog carries both codes of each pair and aliases the molar one to its mass primary, so a report using either spelling of the scale lands in the same panel row, the same badge and the same chart series. A file already written the wrong way round is repaired offline by rewriting its codes; the mechanics are in [the interchange format](../../tech/interchange-format.md#a-wrong-unit-here-is-usually-a-wrong-loinc).

## `unit` versus `rawUnit`

The day a derived unit is *stored*, the two fields split the roles the interchange format already splits elsewhere:

| Field | Holds | Role |
| --- | --- | --- |
| `unit` | the canonical UCUM code | what code computes on |
| `rawUnit` | the string the lab printed | the record of what was read |

`rawUnit` is [documented in the interchange format](../../tech/interchange-format.md#rawunit) and not implemented — upload ignores it, export never writes it. It exists so that the day `unit` is rewritten, the rewrite is auditable and reversible rather than lossy.

This is the format's existing pattern, twice over: `rawValue` preserves a printed `< 0.01` that `value` plus `comparator` parse lossily, and the app keeps each observation's printed name as provenance against the official LOINC name it resolves. In each pair the derived field is the one code uses, and the raw one is the receipt.

That day has not come. Deriving a canonical unit is built; writing one down is not, so `unit` still holds the printed string and `rawUnit` holds nothing. Nothing about today's data is wrong — it is simply un-normalized, and the derivation stays a read of the data rather than a change to it.

## Mapping is ambiguous, so it must be reviewable

Not every printed unit resolves cleanly. `%` can mean a fraction of a differential count or a mass fraction; a bare `U/L` may or may not be the same assay unit another lab means by it; `mIU/L` and `µIU/mL` are numerically equal but not the same string, and a lab that prints one may or may not have meant the other. Some rows will resolve to nothing at all.

So normalization is not a batch rewrite. It must behave the way the LOINC cross-check behaves: derive a suggestion, show it, and let the user confirm it — confirmable suggestions, never a silent rewrite of what the lab printed. A unit the resolver can't place stays as printed, flagged rather than guessed. The derivation already obeys this by construction, returning nothing where it is unsure; what does not exist yet is the place a person sees the suggestion and says yes.

## Where it lives today

Per-observation, in each stored diagnostic report, as printed.

The unit knowledge the derivation reads from was already written down for another purpose: the per-code allowed-unit sets encode which units a LOINC code may carry, and the cross-check uses them to disambiguate codes. They started out hand-kept in `web/src/data/loincCheck.ts` and now live on the catalog entry itself (`unit` plus `allowedUnits`), derived into `DEFAULT_UNITS` and `ALLOWED_UNITS` by `web/src/data/analyteCatalog.ts` ([ADR-0010](../../tech/decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md)) and compared through the `canonicalUnit` folding helper described above. The dimension check reads the same sets to decide what a code expects — the seed grew into the check, without becoming a second copy of the same facts.

Tracked as [task-0011](../../tasks/task-0011.md).
