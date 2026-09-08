# Molar masses

The reference data behind every mass↔molar conversion in the app —
and the reason none of those conversions is a hand-typed number.

Data: [`web/public/data/molar-masses.json`](../../web/public/data/molar-masses.json).
Schema:
[`web/public/schema/molar-masses-1.schema.json`](../../web/public/schema/molar-masses-1.schema.json)
(draft 2020-12, closed objects, the same style as the analyte
catalog's). Derivation:
[`web/src/data/molarMasses.ts`](../../web/src/data/molarMasses.ts).
The rule it exists to enforce is
[ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md);
the product-level reasoning about units is the
[unit](../product/concepts/unit.md) concept.

## What it stores, and what it refuses to store

It stores **molar masses. Never conversion factors.**

A factor is a molar mass plus a pair of unit prefixes — "38.6664 mg/dL
per mmol/L" is "cholesterol is 386.664 g/mol" divided by ten. Writing
the factor down instead of the mass writes down the answer to one
question and loses the fact that answered it: the next unit pair needs
a second hand-computed number, nothing ties the two together, and
neither one carries a source. So `molarMasses.ts` derives what a call
site asks for — `massPerMolarUnit(id, massUnit, molarUnit)` and its
reciprocal `molarPerMassUnit` — by scaling the tabulated mass with the
two units' decimal prefixes, and throws on a unit it does not fully
understand (an activity, a count, a unit with no volume) rather than
returning a guess.

Nor is the mass itself a bare constant. Each entry carries the
molecular `formula` its `molarMassGPerMol` was computed from, and the
file tabulates the standard atomic weights that computation used, so
the whole chain is inspectable:

```text
CIAAW atomic weight → formula → molarMassGPerMol → factor for a unit pair
```

The atomic weights are CIAAW's *Standard atomic weights 2021*
(the IUPAC Commission on Isotopic Abundances and Atomic Weights),
ten elements — only the ones these analytes are made of, not a
periodic table. Six of them (H, C, N, O, Mg, S) are published by CIAAW
as an **interval** rather than a single number, because their isotopic
composition varies by source; for those the file takes the abridged
table's conventional value and records the published interval verbatim
in `publishedAs`, so the collapse from interval to number is visible
rather than assumed. The other four (P, Ca, Fe, I) come from the full
table with their parenthesised uncertainty.

This is also why the masses here carry more digits than a chemistry
handout: PubChem prints four significant figures and computes on an
older set of atomic weights, so testosterone reads **288.431** here
where a hand-typed table said 288.42. Masses are rounded to six
decimals.

## The analytes

Seventeen entries. An entry exists because something in the app needs
it: a [mass/molar LOINC sibling pair](README.md#unit-normalization), or
a computed index whose formula wants an input in the other unit
system. The `id` is not a LOINC — several codes share one mass, since
total, HDL and LDL cholesterol are all cholesterol.

| id | Formula | g/mol | Basis | Source |
| --- | --- | --- | --- | --- |
| `cholesterol` | C27H46O | 386.664 | compound | [PubChem CID 5997](https://pubchem.ncbi.nlm.nih.gov/compound/5997) |
| `triglyceride` | C57H104O6 | 885.453 | **conventional** | [PubChem CID 5497163](https://pubchem.ncbi.nlm.nih.gov/compound/5497163) (triolein) |
| `glucose` | C6H12O6 | 180.156 | compound | [PubChem CID 5793](https://pubchem.ncbi.nlm.nih.gov/compound/5793) |
| `creatinine` | C4H7N3O | 113.12 | compound | [PubChem CID 588](https://pubchem.ncbi.nlm.nih.gov/compound/588) |
| `urea` | CH4N2O | 60.056 | compound | [PubChem CID 1176](https://pubchem.ncbi.nlm.nih.gov/compound/1176) |
| `urea-nitrogen` | N2 | 28.014 | **conventional** | [CIAAW nitrogen](https://www.ciaaw.org/nitrogen.htm) + [PubChem CID 1176](https://pubchem.ncbi.nlm.nih.gov/compound/1176) |
| `bilirubin` | C33H36N4O6 | 584.673 | compound | [PubChem CID 5280352](https://pubchem.ncbi.nlm.nih.gov/compound/5280352) |
| `urate` | C5H4N4O3 | 168.112 | compound | [PubChem CID 1175](https://pubchem.ncbi.nlm.nih.gov/compound/1175) |
| `calcium` | Ca | 40.078 | element | [CIAAW calcium](https://www.ciaaw.org/calcium.htm) |
| `iron` | Fe | 55.845 | element | [CIAAW iron](https://www.ciaaw.org/iron.htm) |
| `magnesium` | Mg | 24.305 | element | [CIAAW magnesium](https://www.ciaaw.org/magnesium.htm) |
| `phosphorus` | P | 30.973762 | element | [CIAAW phosphorus](https://www.ciaaw.org/phosphorus.htm) |
| `testosterone` | C19H28O2 | 288.431 | compound | [PubChem CID 6013](https://pubchem.ncbi.nlm.nih.gov/compound/6013) |
| `cortisol` | C21H30O5 | 362.466 | compound | [PubChem CID 5754](https://pubchem.ncbi.nlm.nih.gov/compound/5754) |
| `thyroxine` | C15H11I4NO4 | 776.87388 | compound | [PubChem CID 5819](https://pubchem.ncbi.nlm.nih.gov/compound/5819) |
| `triiodothyronine` | C15H12I3NO4 | 650.97741 | compound | [PubChem CID 5920](https://pubchem.ncbi.nlm.nih.gov/compound/5920) |
| `dheas` | C19H28O5S | 368.488 | compound | [PubChem CID 12594](https://pubchem.ncbi.nlm.nih.gov/compound/12594) |

Each row's full citation — including the mass the source itself
prints, and the date it was retrieved — is in the data file. Formula
and identity came from PubChem; the significant digits came from
CIAAW, which is why the two disagree in the last place or two and the
conformance suite asks them to agree only within 0.05%.

## Where the honesty is: `basis`

`basis` says how true a number is, and the distinction is modelled in
the data rather than left in a comment somewhere downstream:

- **`compound`** — a single molecular species, so the molar mass is
  exact.
- **`element`** — the analyte is an element measured as itself, so the
  value is an atomic weight.
- **`conventional`** — there is no single true molar mass, and
  clinical practice agrees on a stand-in. The schema *requires* such an
  entry to carry a `note` saying what the convention is, and a test
  enforces it.

Two entries are conventional, for two different reasons:

- **Triglyceride is a mixture, not a compound.** Serum triglycerides
  are triacylglycerols with assorted fatty-acid chains; there is no
  molecule whose mass they all share. The clinical convention converts
  on the **triolein** (glyceryl trioleate) equivalent, and that is what
  is tabulated — a representative species standing in for a
  distribution, which is a choice and not a measurement.
- **Urea nitrogen is an atom count.** Blood urea nitrogen is reported
  on a nitrogen basis, not as urea, so 28.014 g/mol is not any
  molecule's mass: it is the two nitrogen atoms each urea molecule
  carries. That is why its entry cites CIAAW's nitrogen weight for the
  number and urea's PubChem entry only to establish the atom count, and
  why it is the one entry with no source mass to check against —
  nothing anywhere publishes "28.014 g/mol of urea nitrogen".

Two further entries are exact as tabulated but carry a `note`, because
what the number *applies to* is not obvious:

- **Phosphate reports elemental phosphorus.** LOINC names the analyte
  "Phosphate", but both the mass and the molar scale report elemental
  P. The factor is therefore phosphorus's atomic weight (30.974), never
  the molar mass of PO₄ (94.97) — a mistake that would be 3× wrong and
  look plausible.
- **Direct bilirubin is a convention wearing an exact number.** The
  entry is unconjugated bilirubin, and clinical practice applies that
  same mass to the total, direct and indirect fractions. Conjugated
  (direct) bilirubin actually circulates as the mono- and
  di-glucuronide and so has a larger true mass, so the direct
  fraction's factor is conventional even though the entry is not:
  total and indirect are exact, direct is a convention the whole field
  shares.

## What the consolidation corrected

Two hand-typed numbers did not survive being asked where they came
from, and they are the argument for the file existing:

- **Glucose had two different divisors in one codebase.**
  `computedIndices.ts` used 18.018 (inherited from v2) while
  `massMolarSiblings.ts` used 18.016 — a live divergence, with no way
  to tell which was meant. 180.156 g/mol makes it **18.0156**.
- **Triglyceride's 88.57 could not be reproduced.** The figure is
  widely quoted in online converters, but it does not follow from
  triolein's molar mass under any published set of atomic weights, and
  no source for it could be found. The derived value from triolein is
  **88.545**, and that is what the app now uses.

Re-deriving the constants moved eight expected values in the
computed-index golden masters by **at most 0.07% relative**, changing
no value the UI displays at two decimal places. It is a constants
correction, not a change to any formula — the test file says so where
the golds are declared.

## What checks it

`web/test/reference-data.test.ts`, alongside the analyte catalog's
checks:

- the file validates against `molar-masses-1.schema.json` with ajv, and
  the closed objects mean a mistyped key fails the suite rather than
  being ignored at runtime;
- every tabulated mass is **recomputed from its own formula** and the
  file's atomic weights, so `molarMassGPerMol` cannot drift from the
  formula beside it;
- every mass agrees with a cited source's own reported mass to within
  0.05% — loose enough for PubChem's four significant figures, tight
  enough to catch a wrong formula or a transposed digit;
- a `conventional` entry has a note; no `id` appears twice;
- every mass/molar sibling pair names a tabulated entry, and the
  derived factors are spot-checked in both directions across the
  decimal prefixes in play (mg/dL, µg/dL, ng/dL, pg/mL against mmol/L,
  µmol/L, nmol/L, pmol/L);
- a unit the derivation does not fully understand throws instead of
  returning a number.

## Who uses the factors

- **`web/src/data/massMolarSiblings.ts`** — the 21 curated mass/molar
  LOINC sibling pairs. Each pair now declares only `molarMass: '<id>'`;
  its `massPerMolarUnit` and `molarMassGPerMol` are derived. The remedy
  for a molar unit under a mass code is still the sibling code, never a
  rewritten number
  ([ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md)); the
  factor's one use is display-time, in the "What's in range" chart's
  `placeOnBandScale` (`web/src/components/conditions/exploreModel.ts`),
  which puts every reading on the unit its reference band is expressed in so
  a history that switched scales plots as one line. Nothing it produces is
  stored or exported.
- **`web/src/data/computedIndices.ts`** — the eight conversions an
  index formula needs to get its inputs onto one scale (cholesterol,
  triglyceride and glucose mg/dL→mmol/L; testosterone, free T3, free
  T4, cortisol and DHEA-S onto their molar units). All eight are
  derived. One of them, testosterone ng/dL→nmol/L, had been declared
  twice under two names; it is now declared once. The *unit pairs* those
  eight work in are themselves declared once, in the exported
  `INDEX_UNIT_PAIRS` — which is what the Reference Book page reads. It
  had hardcoded T3's and DHEA-S's pairs, the two analytes that back a
  computed index without appearing in `MASS_MOLAR_SIBLINGS` and so had
  no other written-down pair to read. The clinical definitions that
  consume the derived factors live in `web/src/data/indexDefs.ts`. Its
  same-dimension rescales — testosterone `ng/mL` ↔ `ng/dL`, the
  apolipoproteins' `g/L` ↔ `mg/dL` — go through `molarMasses.ts`'s
  `concentrationRatio` instead. No molar mass is involved in those, but the
  function sits beside the ones that need one so that a caller never types
  a hardcoded `× 100` out either; that is what it replaced.

Nothing in the app converts a *stored* value on the strength of any of
this. Conversion is for comparability — putting two markers of one index,
or one marker's own history, onto one scale — never for correcting a row.

## Where a reader sees it

The Reference Book's **Mass ↔ molar conversion** page
(`#reference/molar-masses`, under a "Units" heading) renders this file:
why one analyte reports on two scales, the atomic weights → formula →
g/mol → factor chain worked through cholesterol, the full table with its
`basis` and its PubChem/CIAAW links, and the conventional entries with
their notes quoted verbatim from the JSON. Nothing on it is typed out in
the page — it reads `molarMasses.ts`, so the page cannot drift from the
data the app computes with, which is the point
[ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)
anticipated when it kept `molarMassFromFormula` around.
