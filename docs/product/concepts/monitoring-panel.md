# Monitoring Panel

A named group of [observations](observation.md) tracked together for a monitoring purpose — either a medical condition (e.g. Hypothyroidism, Insulin Resistance) or an organ system (e.g. Kidney Function, Adrenal).

A panel does not imply the user has been diagnosed with the condition it's named after — it's a surveillance grouping, not a diagnosis. "Cardiovascular Risk" and "Kidney Function" are panels in the same sense as "Hypogonadism": a curated set of observations worth watching together.

## Structure

- **Name** — the condition or organ system it monitors (e.g. "Fatty Liver").
- **Observations** — the list of [observations](observation.md) belonging to this panel (by LOINC code).

## Two layers

A monitoring panel is not a laboratory panel, and the product keeps them apart:

- **Laboratory groups** — the way a lab orders and prints a set of analytes ("Full Blood Count", "Lipid Metabolism"). This layer describes the laboratory's world, and the product does not get to redraw it.
- **Monitoring panels** — the product's own grouping, expressed as a *composition* over those groups: start from one group, several groups, or a literal list of LOINCs; drop what the clinical question does not need; add what it does. "Insulin Resistance" is the lab's glucose-metabolism group minus amylase and lipase, plus triglycerides and HDL-C.

Keeping the composition separate means a panel can be re-cut for a clinical question without misrepresenting how any lab actually ordered the draw.

An observation can belong to more than one panel — e.g. Amylase informs both Fatty Liver and Pancreatic Function. Soft draw-together pairs (e.g. Ferritin with Iron / Transferrin / TIBC) are deliberately not panels — they are per-marker and condition-independent, so they're modeled as [companion observations](companion-observation.md) instead.

## What it is not

- **Not a diagnosis** — see above.
- **Not a result set** — a panel defines which observations to watch, not the values recorded for them.

## Where it lives today

Both layers are data ([ADR-0010](../../tech/decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md)): the laboratory groups in `web/public/data/panels.json`, the product's composition over them in `web/public/data/monitoring-panels.json` (`panelId` / `panelIds` / `loincs` for what to start from, then `excludeLoincs` and `extraLoincs`, in array order). `buildConditions` in `web/src/components/conditions/markers.ts` is the resolver — it joins the two against the [analyte catalog](observation.md#where-it-lives-today) and owns no table of its own. Both files are held to `web/public/schema/analytes-1.schema.json` by `web/test/reference-data.test.ts`.

The resolver maps LOINCs one-to-one and does **not** fold alias codes, so a group listing both a primary and one of its unit variants needs the variant in `excludeLoincs` or the panel renders the marker twice — the Insulin Resistance panel excludes HbA1c's IFCC code `59261-8` for exactly this reason, even though the catalog registers it as a variant of `4548-4`.

The Monitoring Panels screen (`web/src/components/conditions/PanelsGridView.tsx`) renders each panel as a list of observation rows, status shown as a small colored dot, with the panel's [computed indices](computed-index.md) listed below a divider (same dot language, colored by ok/warn/bad zone); clicking an observation or index opens a popup with its detail, clicking the panel name opens the panel's detail view. The detail view's Analysis tab adds a "Scheduled" toggle column to both tables (global set in localStorage, shared across panels) and marks the rows related to the selected one with a • beside the name.
