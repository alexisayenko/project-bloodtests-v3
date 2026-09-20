# ADR-0028: Import and export carry the stored files verbatim

Status: accepted · 2026-09-20 · amends [ADR-0003](adr-0003-store-only-what-the-lab-printed.md)
(its export wording) · amends [ADR-0026](adr-0026-github-backed-cloud-storage.md)
(the client's split / merge)

## Context

The per-report JSON files in the private repo `alexisayenko/data-storage`
(`paneloom/users/<email>/reports/YYYY-MM-DD__<lab>.json`, `medications.json`,
`scheduled-visits.json`, `settings.json`, `manifest.json`) are the truth. The
app used to parse them into a display model in `localStorage` and rebuild every
file from that model on export and push: `unit` was re-derived from `rawUnit`,
`interpretation`, `specimen`, `identifiers` and `comparator` were dropped,
`collectedAt` was rewritten to midnight, `contentHash` was recomputed and files
were re-split and re-slugged. A pull followed by a push therefore rewrote data
the user had not touched, and an owner correction made in the data repo (the
`unit` relabel of [ADR-0025](adr-0025-mchc-percent-is-not-an-accepted-unit.md))
was undone on the next push. Data errors are fixed in the data repo, not by
app logic. The owner's requirement: import and export produce zipped JSONs
identical to what is stored, and never recalculate or rebuild.

## Decision

**A stored file is never rebuilt.** Import (zip, JSON upload, cloud pull)
captures each file's text and holds it next to the parsed display model
(`web/src/data/storage/heldFiles.ts`, `localStorage` key
`paneloom_held_files_v1`; each session carries `source: {path, index}`). Zip
export and cloud push return the held texts unchanged, so zip export -> import
-> export and cloud pull -> push are byte-identical, and a pull-then-push with
no edits commits nothing (the held manifest is resent while the payload digest
is unchanged). The zip is exactly the stored layout; the legacy
`lab-reports.json` zip and single-envelope uploads are still read.

The app writes a file in three places only:

1. **A new upload** is split into one single-report envelope per report by
   spreading the original objects (no whitelist, no unit derivation), named
   `reports/YYYY-MM-DD__<lab>.json`, two-space JSON plus a newline. A
   single-report upload that already carries `lastUpdatedDate` keeps its text.
2. **An edit** patches the touched observation fields of that one file and
   re-serializes only it.
3. **A session with no stored file** (generated data, or sessions from an older
   build) gets one file built once, `rawUnit` only, no derived `unit`.

A deleted report has its file removed. Local view files (`medications.json`,
`scheduled-visits.json`, `settings.json`) are held as imported and rebuilt from
browser storage only once they change. Export never sources envelope metadata
from `localStorage`; Database details keeps `sex` only.

**`lastUpdatedDate`** (schema `3.2`, optional, ISO 8601 UTC) is set or
refreshed only when report data is modified in the app (a new report from an
upload, or an edit) and never on import, pull or export of an unmodified file.
**`generatedAt`** is removed: the app no longer writes or models it; it stays
in the schema as a deprecated optional property, and a legacy file that
carries it imports with no error or warning and passes through verbatim.

## Amendments

- **ADR-0003**: "the printed value is never converted" now also means "the
  stored file is never rebuilt". Export previously wrote a derived `unit`;
  it writes the stored one.
- **ADR-0025**: the owner's relabel of `unit` in the data repo now survives
  export and push, and the unit checks read that stored `unit` rather than
  `rawUnit` (`rawUnit` only when `unit` is absent), so the relabel also clears
  the warning.
- **ADR-0026**: the client no longer splits and merges a `lab-reports.json`;
  it moves the per-report files as they are.

## Consequences

- `web/src/utils/exportData.ts` and its `computeSha256Hash` are deleted;
  `contentHash` is computed synchronously (`web/src/data/contentHash.ts`, only
  for files the app writes or edits).
- localStorage holds the held texts beside the sessions: about 190 KB + 97 KB
  for the two real folders against a quota of about 5 MB.
- An edited file is re-serialized (`4.50` becomes `4.5` in that file only).
- A cloud folder with no manifest gets one on the first push.
- The data-loss guards stay: an empty local backup never overwrites a
  populated cloud, and sign-out pushes first and wipes only when saved.
- Revisit if the held store nears the quota (move it to IndexedDB).
