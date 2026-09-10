# Laboratory prices

What each laboratory charges for the tests it sells, and why each product maps
to the catalog codes it does. The prices themselves are not on this page. They
live in [`web/public/data/laboratories.json`](../../web/public/data/laboratories.json),
the laboratory registry and the single source of truth for prices, described by
[`laboratories-1.schema.json`](../../web/public/schema/laboratories-1.schema.json)
and held to it by `web/test/reference-data.test.ts`. Change a price there, not
here. This page keeps only the reasoning a JSON file has no room for. The work
is tracked in [task-0019](../tasks/task-0019.md).

## How a price line is read

Each laboratory carries a `currency` (ISO 4217), a `pricesAsOf` date, a
`source`, and a `locale` whose digit grouping its totals are written with. Each
price line carries:

- **`label`**: the laboratory's name for the product, as given, not normalized.
- **`price`**: in the laboratory's currency, as of its date.
- **`covers`**: every catalog LOINC the product can satisfy. A plain test
  covers one code. A bundle covers many. A label that does not pick one code,
  because it names no specimen or no method, covers every code it could mean.
- **`panelId`**: set on a bundle that is a laboratory group in `panels.json`. A
  JSON file cannot reference another, so `covers` still lists the codes, and
  the conformance suite fails if they stop being exactly that group's.
- **Mass and molar siblings**: a price is for the test, not for the unit it is
  reported in. `covers` lists the mass primary (the code with no `aliasOf`),
  and costing folds every code through the catalog's aliases on both sides, so
  a history reported in mmol/L is priced like one reported in mg/dL.

## How a schedule is costed

`quoteSchedule` in `web/src/data/labPricing.ts` takes the scheduled LOINCs as
stored and folds each to its primary. Every code takes the cheapest line
covering it, and a line covering several scheduled codes is charged once, so a
bundle is paid once. Codes no line covers are reported, not dropped. The total
is over the whole schedule, whatever filter a table is showing. It is the
cheapest line per code, not the cheapest combination of lines: if a laboratory
sells a test on its own and inside a bundle, scheduling that test and one other
bundle member charges both the test and the bundle.

## Esculab

Prices in UAH as of 2026-09-10, entered by the user.

- **ALP** is `6768-6`, a catalytic activity with no molar sibling.
  Bone-specific ALP (`17838-4`) is a separate test and is not what this label
  names.
- **ALT** (`1742-6`) and **AST** (`1920-8`) have no sibling code in the catalog.
- **FBC** is a bundle, taken to be the catalog's whole `fbc` group: 26 codes
  across leukocytes and differentials, erythrocytes and platelets. Which of
  those Esculab's FBC really includes, for example whether the differential is
  part of it, has not been recorded.
- **Glucose** was written in Russian by the user, and the label names no
  specimen. Serum or plasma is `2345-7` (molar sibling `14749-6`) and whole
  blood is `2339-0` (molar sibling `15074-8`). These are different tests, so the
  line covers both.
- **HDL-C** is `2085-9`. Its molar sibling `14646-4` folds into it.
- **LDL-C** names no method. Calculated LDL-C is `13457-7` (molar `22748-8`,
  which carries no method and is aliased to it), and that is the code the line
  covers, because the catalog holds no directly measured LDL-C code yet. A
  calculated value is derived from TC, HDL-C and TRIG, so a separate price may
  point to a direct assay. That is unconfirmed.
- **TBIL** is `1975-2`. Its molar sibling `14631-6` (umol/L) folds into it.
- **TC** is `2093-3`. Its molar sibling `14647-2` folds into it.
- **TRIG** is `2571-8`. Its molar sibling `14927-8` folds into it.

## Medis

Prices in UAH as of 2026-09-10, entered by the user, for the same ten labels
as Esculab plus eight Esculab does not price. Each shared label maps to the same
codes for the same reasons given above, including the open questions: which
codes Medis's FBC really includes, and whether its LDL-C is a direct assay,
have not been recorded.

- **ApoB** is `1884-6`, apolipoprotein B by mass. The catalog holds no molar
  or method variant of it.
- **C-peptide** is `1986-9`, serum or plasma C-peptide by mass. The catalog
  holds no molar or method variant of it.
- **Creatinine** is `2160-0`, serum or plasma. Its molar sibling `14682-9`
  (umol/L) folds into it.
- **GGT** is `2324-2`, gamma-glutamyl transferase, a catalytic activity with no
  molar or method variant in the catalog.
- **HbA1c** is `4548-4`. The calculated code `17855-8` and the IFCC code
  `59261-8` are both aliased to it, so the one code covers all three.
- **hsCRP** is `30522-7`, CRP by the high-sensitivity method. Standard CRP
  (`1988-5`) is a separate test in the catalog and is not what this label names.
- **Insulin** is `20448-7`, serum or plasma insulin in International Units. The
  catalog holds no other insulin code, so the label has only one code to mean.
- **Uric acid** is `3084-1`, urate by mass. Its molar sibling `14933-6`
  (umol/L) folds into it.

## Synevo

Prices in UAH as of 2026-09-10, entered by the user, for all eighteen of
Medis's labels. Each label maps to the same codes for the same reasons given
above, including the open questions: which codes Synevo's FBC really includes,
and whether its LDL-C is a direct assay, have not been recorded.

## Synevo Ukraine, removed

The registry used to hold Synevo Ukraine (`synevo-ua`): its name, URL,
translations, and its own product codes for two tests, TSH (`1004`) and
calcitonin (`2068`). It had no prices and nothing read it, so it was removed
when the registry became the home of prices. The laboratory is now priced as
`synevo`, above; the old entry's product codes remain in git history.
