# Tech

Stack, infrastructure, and architectural decisions. The "how it
runs" layer — what's used to build and operate the product.
Product / business / UX live in their own sections.

## Current files

- [`interchange-format.md`](interchange-format.md) — envelope of
  the lab-data interchange file (spec; partially implemented —
  see its status note).
- [`decisions/`](decisions/) — ADRs, one file per decision
  (`adr-NNNN-<slug>.md`, numbered independently of v2).

## Upload & Edit Workflow

The core user journey for data ingestion and local editing:

1. **Build JSON** — User or a chatbot generates v3-format lab data JSON (using the envelope specified in [`interchange-format.md`](interchange-format.md)). The copyable chatbot prompt lives on the Diagnostic Reports page's "Add a report" card (step 1, expandable); it instructs the chatbot to prefer lab-printed LOINC codes over its own knowledge (but only codes matching the LOINC pattern — a lab-internal code like "900101" is treated as no printed code), keep one draw as one report, ignore footnote/flag markers, never translate test names (a multi-line or bilingual name collapses to one single-line string), skip pending results ("Not ready" / "Pending" / an empty cell) with a notice so they can be re-imported later, normalize decimal commas, preserve special-character units (μ, ×10⁹/L), silently self-check observation counts and then list every draw date + lab for the user to confirm nothing is missing, and deliver a downloadable UTF-8 .json file rather than dumping JSON into the chat (a fenced code block only as fallback).

2. **Upload** — File is imported into the app:
   - Parser (`web/src/data/parseUpload.ts`) validates v3 JSON structure (and still accepts v2 canonical-draws and two legacy array shapes).
   - **Validation tiers** (`web/src/data/validateDiagnosticReports.ts`): an observation missing its test name or a value (numeric `value` *or* non-empty `rawValue`), or carrying a non-empty code that isn't LOINC-shaped (`^\d{1,7}-\d$` — catches lab-internal codes like "900101"), is an **error**; an empty LOINC (the observation won't appear in panels or All Observations), a missing unit, and a missing reference range (no min+max pair and no reference text) are **warnings**. While any error exists, Monitoring Panels and All Observations are disabled in the nav and their routes redirect to Diagnostic Reports; Get Started and Reference Book stay reachable. Warnings are informational only.
   - Get Started's "Import JSON" button, the identical button on Diagnostic Reports' "Back up your database" card, and share-link imports replace all stored sessions (import-replace model); the "Add a report" card's step-3 **Add** button (with "Adding…" progress and "✓ Added N reports" feedback) and generated test data merge by session id instead. A v3 report's `identifiers` (visit/order/accession) feed the session id, so two same-day same-lab draws no longer collide and replace each other on merge.
   - All data stays local in `localStorage` — nothing reaches a server.

3. **Edit in Diagnostic Reports** — the management hub. Top to bottom: a collapsible "Database details" card, the reports table, the "Add a report" card, and a "Back up your database" card (Export JSON / Import JSON (replaces) / Clear behind a divider). The user can:
   - View parsed lab results grouped by report date/lab, with per-report error/warning dots.
   - Fix errors by inline-editing each observation's LOINC, value, and unit in the report detail view.
   - Cross-check LOINCs (`web/src/data/loincCheck.ts`): a "Cross-check LOINCs" button runs an offline pass against the local analyte catalog and badges each row — ✓ code matches the printed name, ⚠ code resolves but the printed name differs, ✗ unknown code — showing the official LOINC name in grey under the printed name (the printed name is preserved as provenance; resolved names are session-only, never stored) and offering clickable code-suggestion chips for codeless rows. A second-stage "Check online (NLM)" button, offered only for rows the offline pass couldn't resolve, sends test names — never values — to clinicaltables.nlm.nih.gov; this explicit opt-in is the single exception to the everything-stays-local rule.
   - Edit envelope metadata in "Database details": subject, sex, birth year, notes, plus a read-only `generatedAt` stamped on each export. Persisted under localStorage key `bloodtests_envelope_meta_v1` and written into the export envelope (empty fields omitted). Sex/birthYear are not yet *used* for reference-range selection — they're carried in the envelope only.

4. **Save Locally** — Changes auto-save to `localStorage` (no manual save button; data persists across sessions).

5. **Export** — User can export back to v3 envelope JSON (from Diagnostic Reports' "Back up your database" card):
   - Includes `generatedAt` and an updated `contentHash` for change detection, plus subject/sex/birthYear/notes when set in "Database details".
   - Writes a reduced envelope — not every spec field is emitted yet; see the [interchange-format status note](interchange-format.md).
   - Ready to share or version control.

**Data privacy:** Everything stays client-side. No file ever reaches a server except optionally via a share link on a Cloudflare Worker (read-only, no reverse lookup); the one other explicit-opt-in exception is the "Check online (NLM)" LOINC lookup, which sends test names (never values) to clinicaltables.nlm.nih.gov. The format itself carries no identity — see [`interchange-format.md#subject`](interchange-format.md#subject).

## Common slots

Don't pre-create — extract on first real entry. See
[Section, file, folder](../README.md#section-file-folder).

- **`stack.md`** — the v1 stack: framework, hosting, storage,
  payments, language, etc., with rationale per pick.
- **`architecture.md`** — system overview, data flow, key
  components.
(`decisions/` has been extracted — see [Current
files](#current-files).)

## Open questions

- [TODO: architectural decisions still open.]
