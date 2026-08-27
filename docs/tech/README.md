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

1. **Build JSON** — User or a chatbot generates v3-format lab data JSON (using the envelope specified in [`interchange-format.md`](interchange-format.md)).

2. **Upload** — File is imported into the app:
   - Parser (`web/src/data/parseUpload.ts`) validates v3 JSON structure (and still accepts v2 canonical-draws and two legacy array shapes).
   - **Validation tiers** (`web/src/data/validateDiagnosticReports.ts`): an observation missing LOINC, test name, a value (numeric `value` *or* non-empty `rawValue`), or unit is an **error**; a missing reference range (no min+max pair and no reference text) is a **warning**. While any error exists, Monitoring Panels and All Observations are disabled in the nav and their routes redirect to Diagnostic Reports; Get Started and Reference Book stay reachable. Warnings are informational only.
   - Get Started's "Upload JSON" button and share-link imports replace all stored sessions (import-replace model); its step-2 "Upload raw JSON" button and generated test data merge by session id instead, and a successful step-2 upload redirects to `#reports`.
   - All data stays local in `localStorage` — nothing reaches a server.

3. **Edit in Diagnostic Reports** — User navigates to the Diagnostic Reports view to:
   - View parsed lab results grouped by report date/lab, with per-report error/warning dots.
   - Fix errors by inline-editing each observation's LOINC, value, and unit in the report detail view. *Planned:* Phase 4 will suggest LOINC codes based on lab-printed names.
   - *Planned:* refine sex/birthYear envelope fields for proper reference-range selection, and edit other report-level metadata — not implemented yet.

4. **Save Locally** — Changes auto-save to `localStorage` (no manual save button; data persists across sessions).

5. **Export** — User can export back to v3 envelope JSON (from Get Started or Diagnostic Reports):
   - Includes updated `contentHash` for change detection.
   - Writes a reduced envelope — not every spec field is emitted yet; see the [interchange-format status note](interchange-format.md).
   - Ready to share or version control.

**Data privacy:** Everything stays client-side. No file ever reaches a server except optionally via a share link on a Cloudflare Worker (read-only, no reverse lookup). The format itself carries no identity — see [`interchange-format.md#subject`](interchange-format.md#subject).

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
