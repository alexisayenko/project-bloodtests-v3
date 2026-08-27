# Tech

Stack, infrastructure, and architectural decisions. The "how it
runs" layer — what's used to build and operate the product.
Product / business / UX live in their own sections.

## Current files

- [`interchange-format.md`](interchange-format.md) — envelope of
  the lab-data interchange file (implemented).
- [`decisions/`](decisions/) — ADRs, one file per decision
  (`adr-NNNN-<slug>.md`, numbered independently of v2).

## Upload & Edit Workflow

The core user journey for data ingestion and local editing:

1. **Build JSON** — User or a chatbot generates v3-format lab data JSON (using the envelope specified in [`interchange-format.md`](interchange-format.md)).

2. **Upload** — File is imported into the app:
   - Parser (`web/src/data/parseUpload.ts`) validates v3 JSON structure.
   - **Validation tiers:** Errors block access to other routes; warnings are informational only.
   - File replaces all stored sessions (import-replace model) or merges if generating synthetic test data.
   - All data stays local in `localStorage` — nothing reaches a server.

3. **Edit in Diagnostic Reports** — User navigates to the Diagnostic Reports view (Phase 3) to:
   - View parsed lab results grouped by report date/lab.
   - Add missing LOINC codes (Phase 4 will suggest based on lab-printed names).
   - Refine sex/birthYear envelope fields for proper reference-range selection.
   - Edit other report-level metadata.

4. **Save Locally** — Changes auto-save to `localStorage` (no manual save button; data persists across sessions).

5. **Export** — User can export back to v3 envelope JSON:
   - Includes updated `contentHash` for change detection.
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
