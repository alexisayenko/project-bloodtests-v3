# Monitoring Panel

A named group of [observations](observation.md) tracked together for a monitoring purpose — either a medical condition (e.g. Hypothyroidism, Insulin Resistance) or an organ system (e.g. Kidney Function, Adrenal).

A panel does not imply the user has been diagnosed with the condition it's named after — it's a surveillance grouping, not a diagnosis. "Cardiovascular Risk" and "Kidney Function" are panels in the same sense as "Hypogonadism": a curated set of observations worth watching together.

## Structure

- **Name** — the condition or organ system it monitors (e.g. "Fatty Liver").
- **Observations** — the list of [observations](observation.md) belonging to this panel (by LOINC code).

An observation can belong to more than one panel — e.g. Amylase informs both Fatty Liver and Pancreatic Function.

## What it is not

- **Not a diagnosis** — see above.
- **Not a result set** — a panel defines which observations to watch, not the values recorded for them.

## Where it lives today

Panel-to-LOINC groupings are defined in `web/public/data/panels.json`. The Monitoring Panels screen (`web/src/components/conditions/PanelsGridView.tsx`) renders each panel as a list of observation rows, status shown as a small colored dot; clicking an observation opens a popup with its full name and LOINC detail, clicking the panel name opens the panel's detail view.
