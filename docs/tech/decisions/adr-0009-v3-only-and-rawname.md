# ADR-0009: v3-only upload, and `name` renamed to `rawName`

Status: accepted · 2026-09-07

Supersedes [ADR-0006](adr-0006-envelope-schema-numbered-3.md)'s
"`1` stays accepted on import". Its "`schema` accepts `3` only" is
widened to any minor of major 3 by
[ADR-0012](adr-0012-envelope-version-is-a-major-minor-string.md); the
bare number `3` is still read, as `3.0`.

## Context

Upload accepted four shapes: the v3 envelope, envelopes stamped
`schema: 1`, project-bloodtests-v2's canonical draws, and two flat
legacy shapes inherited from the original private project. Three of
those four were read only for files that no longer get produced. The
cost was not the code volume but the detection order: each shape has
a sniff function, the sniffs overlap (a canonical draw and a legacy
grouped session are both `{ date, ..., items }`), and every one of
them is a way a malformed v3 file can be silently misread as
something else and imported wrong rather than rejected.

The same detection logic also lives in
`web/scripts/convert-to-v3.mjs`, which converts an old file to a v3
envelope offline. So the legacy readers in the app were a second
copy of a migration path that already existed elsewhere.

Separately, an observation's printed test name was stored under
`name`. Every other provenance field in the format is marked as such
— [`rawValue`](../interchange-format.md#rawvalue),
[`rawUnit`](../interchange-format.md#rawunit) — and `name` is
provenance too: it is what the row said on paper, never a matching
key ([ADR-0004](adr-0004-derive-loinc-from-name-and-unit.md) put
matching entirely on the LOINC code). A bare `name` reads as *the*
name of the test, which invites exactly the name-matching the format
forbids.

Both changes are breaking, and both are cheap right now: the format
is fed by one producer (the chatbot prompt in the Diagnostic Reports
view), the only files in existence are dev data and share payloads
that get regenerated, and no real patient data has landed yet. The
window closes as soon as it does.

## Decision

**The app reads the v3 envelope and nothing else, and an
observation's printed test name is stored under `rawName`.**

- [`schema`](../interchange-format.md#schema) accepts `3` only.
  `web/src/data/envelopeSchema.ts` keeps `SCHEMA_VERSION = 3` and
  drops the accepted-set indirection: one number, one comparison.
  Anything else — `1`, `2`, a legacy array shape, a bare object —
  fails with one "Unrecognized JSON shape" error naming the envelope
  it wanted.
- `web/scripts/convert-to-v3.mjs` **keeps every legacy input
  branch**. It is the migration tool, and it has to go on reading
  old files after the app has stopped. Its output follows the
  rename: an observation carrying `name` is rewritten to `rawName`,
  including in an envelope already stamped `3`.
- [`rawName`](../interchange-format.md#rawname) is required on every
  observation, in the prose spec, in the published JSON Schema, and
  in the chatbot prompt. `name` is not read as a fallback: a file
  carrying it fails validation, which is the point — a silent
  fallback would keep the old key alive in files forever.

The rename is not symmetrical with `rawValue`/`value`, and that
asymmetry is the reason for the name. The friendly name is
derived from the LOINC code **at display time and never stored**, so
there is no `name` sibling by design. `rawName` says the file holds
only what was printed; `name` would imply a canonical string the
format does not carry.

## Alternatives considered

- **Keep reading `schema: 1`.** It costs one entry in a set, but
  the legacy array shapes are the real detection hazard and they
  came off together; leaving `1` in would have kept a version number
  that means "the same format, differently stamped" alive for files
  that a one-line conversion fixes permanently.
- **Accept `name` as a fallback for `rawName`.** Zero migration
  cost, and permanent: two spellings of one field, forever, with
  every writer free to pick either. A rename that is not enforced is
  not a rename.
- **Defer the rename until the format has more than one producer.**
  That is the argument for doing it *now* rather than later — the
  cost of a breaking rename rises with every file and every writer,
  and it is at its floor today.

## Consequences

- **Old backups must be converted before import.** Any file on disk
  stamped `1`, and any v2-era export, goes through
  `npm run convert:v3 -- <file>` once; the converter validates its
  own output against the published schema, so a converted file is
  known-good before it is uploaded.
- Share-link payloads under `web/public/d/` and local dev data are
  regenerated through the converter rather than being read as-is.
- ADR-0006's decision stands on the *number* — 3, aligned with the
  project version — but its "`1` stays accepted" and its
  `ACCEPTED_SCHEMA_VERSIONS` set are superseded here. Its
  consequence "the accepted set only grows, so it records the
  format's history" no longer holds: there is no set, and history
  lives in the converter.
- `web/src/data/drawsSchema.ts`, the zod port of v2's canonical
  shape, had no reader left and was deleted; the converter carries
  its own validation of that shape. ADR-0003 names the file in its
  context section as a matter of record.
- The error surface shrinks to one message. A user uploading
  something unreadable is told what the app wants, rather than being
  told what the closest-matching legacy shape failed to satisfy.

## What would force revisiting

- A second independent producer of these files that cannot be
  changed in step with the app — at which point tolerating an old
  field spelling on read becomes a compatibility question rather
  than a tidiness one.
- Real data landing in files this repo does not generate, which is
  the condition that made this rename cheap disappearing.

## Notes

- 2026-09-11: the app's in-memory `Result` now names the printed name
  `rawName` as well (formerly `analysis`), matching the envelope; the
  envelope itself is unchanged. Unlike the file rename above, sessions
  already stored in a browser are read with `analysis` as a fallback
  (`parseStoredSessions` in `resultsStorage.ts`), since browser storage
  has no converter to go through.
