# Reference Book

`#reference` (`ReferenceBookPage.tsx`, with sub-pages under
`web/src/components/conditions/reference/`), reachable while validation errors
exist. Each page is its own URL hash (`#reference/<key>`, routed
generically) so browser back/forward works. Analyte names in its prose open
the analyte popup through the `onOpenPopup` the shell passes in. The section
groups:

- **Indices and derived measurements** — a page per computed index with
  formula, full clinical prose and cited sources with verbatim quotes, read
  from `INDEX_DEFS` ([`computed-indices.md`](computed-indices.md)). A
  sex-banded index names both bands ("men > … · women < …"), the Reference
  Book having no profile; a citation's optional `retrieved` date shows as
  "· retrieved <date>".
- **Organism-wide aspects** — the HP Axis page (`HpAxisPage`, content in
  `hpAxisContent.ts`: feedback-loop cascades) and the Testosterone page
  (`#reference/testosterone`, `reference/TestosteronePage.tsx`: secretion,
  plasma binding, conversion to DHT / E2, negative feedback and clomiphene as
  flow diagrams, each claim carrying an `[n]` link that scrolls to its quoted
  source without rewriting the routing hash).
- **Formulas and math** — "Mass ↔ molar conversion" (`#reference/molar-masses`),
  rendered entirely from `molarMasses.ts`: why one analyte reports on two
  scales, the atomic-weights → formula → g/mol → factor chain worked through
  cholesterol, the analyte table with `basis` pills and PubChem / CIAAW links,
  the conventional cases quoting the JSON's own notes, and the index unit
  pairs read from `INDEX_UNIT_PAIRS`; and "Units and how they are read"
  (`#reference/units`): why one unit has many spellings, UCUM as the target
  vocabulary, the three normalization stages, the families of spellings that
  are one unit (computed by asking `sameUnitScale`, not tabulated), a "When U
  and IU are one unit" section worked through a table of enzyme / hormone /
  analyte-unknown answers, the SI/US switch, what is never converted, and a
  Sources block (the UCUM spec and its licence, WHO TRS 932 Annex 2, Clinical
  Chemistry's instructions to authors, the LOINC Users' Guide), each with
  what it settles and a retrieval date ([`units.md`](units.md)).
- **Analytes** — the "LOINC database" (`#reference/loinc-database`) listing
  every analyte the catalog knows: LOINC code over its LOINC name, friendly
  name over short name where it differs, specimen, units, last tested
  (`latestEntryByLoinc` with the default `numericOnly: false`, so a text-only
  result counts) and panels, sortable by every column but panels; and the FSH
  page (`#reference/fsh`): FSH's identity, its LOINC references, and a
  molecular-notation walkthrough contrasting a mislabeled PubChem record
  (CID 62819, an unrelated 980 Da peptide carrying "Follicle-stimulating
  hormone" only as a synonym) against FSH's real structure (PDB 1XWD) and a
  glycosylation figure (Lispi et al. 2023, CC BY 4.0, attributed) — images
  under `web/public/reference/fsh/`.
