# LP-IR and insulin-resistance score terminology

Paneloom treats **LP-IR** and **CardioIQ Insulin Resistance Score** as distinct laboratory observations.

## LP-IR

- **LOINC:** `62255-5`
- **LOINC long common name:** Lipoprotein insulin resistance score in Serum or Plasma
- **LOINC Part:** `LP105135-0`
- **LOINC example UCUM unit:** `{Index_val}`
- **Range described by LOINC:** 0–100
- **Meaning:** a lipoprotein-based insulin-resistance score combining six NMR lipoprotein particle size/concentration measurements.
- **Paneloom behavior:** import and display the value reported by the laboratory. Do **not** derive the score locally from component measurements.

Source: https://loinc.org/62255-5

### Supporting research

Harada PHN et al., *Lipoprotein Insulin Resistance Score and Risk of Incident Diabetes During Extended Follow-Up of 20 Years: The Women's Health Study* (J Clin Lipidol. 2017;11(5):1257-1267.e2, PMID 28733174, PMCID PMC5644504, DOI 10.1016/j.jacl.2017.06.008) prospectively followed 25,925 non-diabetic women for a median 20.4 years. LP-IR was a weighted score of six NMR lipoprotein parameters and remained associated with incident type 2 diabetes after adjustment for traditional risk markers, supporting LP-IR as a distinct lipoprotein-based marker of insulin resistance rather than a synonym for glucose-based indices.

Research link: https://pmc.ncbi.nlm.nih.gov/articles/PMC5644504/

LOINC also lists `62255-5` as a required member of the Lipoprofile panel `59062-0`.

## CardioIQ Insulin Resistance Score

This is a different observation and must not be used as an alias for LP-IR.

- **LOINC:** `92845-7`
- **LOINC long common name:** Insulin resistance score in Serum by Calculated.CardioIQ
- **LOINC Part:** `LP310079-1` — Insulin resistance score
- **Inputs described by LOINC:** fasting insulin and C-peptide
- **Method:** Quest CardioIQ proprietary calculation
- **Paneloom status:** not implemented as part of this change.

Sources:
- https://loinc.org/92845-7
- https://loinc.org/LP310079-1

## Implementation decision

LP-IR is modeled as a normal reported observation in `analyses.json`, not as a Paneloom computed index. It is added to the **Insulin Resistance** monitoring panel through `monitoring-panels.json`.

This keeps the product invariant intact: laboratory values are stored/displayed as reported, while derived values are only computed when Paneloom has a documented, reproducible formula and source.
