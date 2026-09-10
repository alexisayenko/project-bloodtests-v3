# Laboratory prices

What each laboratory charges for the tests it sells, recorded by hand. This is
the first data for [task-0019](../tasks/task-0019.md). It is markdown for now.
The app does not read it, and nothing here has been decided about storage,
schema or scope (see that task's open questions).

One section per laboratory. Each section gives the currency, the date the
prices were observed, where they came from, and a table.

## How to read the tables

- **Label**: the laboratory's name for the product, as given. It is not
  normalized.
- **Price**: in the section's currency, as of the section's date.
- **LOINC**: the catalog code the product maps to, checked by code and long
  common name against `web/public/data/analyses.json`. The cell is filled only
  when the mapping is unambiguous. An empty cell means the label does not pick
  one code, and the note says why.
- **Mass and molar siblings**: a price is for the test, not for the unit it is
  reported in. Where the catalog has a mass code and a molar code for the same
  test, the cell gives the primary code (the one with no `aliasOf`). The note
  names the sibling that folds into it, so the price covers the test whichever
  unit the laboratory prints.

## Esculab

- **Currency:** UAH
- **As of:** 2026-09-10
- **Source:** entered by the user
- **Registry:** not yet in `web/public/data/laboratories.json`

| Label | Price | LOINC | Note |
| --- | ---: | --- | --- |
| ALP | 171 | 6768-6 | Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma. Catalytic activity, so no molar sibling. Bone-specific ALP (`17838-4`) is a separate test and is not what this label names. |
| ALT | 171 | 1742-6 | Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma. No sibling code in the catalog. |
| AST | 171 | 1920-8 | Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma. No sibling code in the catalog. |
| FBC | 328 | | This is a bundle, not one test. The catalog's `fbc` laboratory group (`panels.json`) lists 26 codes across leukocytes and differentials, erythrocytes and platelets. Which of those Esculab's FBC includes, for example whether the differential is part of it, has not been recorded. |
| Glucose | 189 | | The user wrote the label in Russian. The label does not name a specimen. Serum or plasma is `2345-7` (molar sibling `14749-6`) and whole blood is `2339-0` (molar sibling `15074-8`). These are different tests. |
| HDL-C | 167 | 2085-9 | Cholesterol in HDL [Mass/volume] in Serum or Plasma. Molar sibling `14646-4` folds into it. |
| LDL-C | 162 | | The label does not name a method. Calculated LDL-C is `13457-7` (molar `22748-8`, which carries no method and is aliased to it). A directly measured LDL-C has a different LOINC code, which the catalog does not hold yet. A calculated value is derived from TC, HDL-C and TRIG, so a separate price may point to a direct assay. That is unconfirmed. |
| TBIL | 171 | 1975-2 | Bilirubin.total [Mass/volume] in Serum or Plasma. Molar sibling `14631-6` (umol/L) folds into it. |
| TC | 167 | 2093-3 | Cholesterol [Mass/volume] in Serum or Plasma. Molar sibling `14647-2` folds into it. |
| TRIG | 185 | 2571-8 | Triglyceride [Mass/volume] in Serum or Plasma. Molar sibling `14927-8` folds into it. |
