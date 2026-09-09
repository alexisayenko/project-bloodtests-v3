# ADR-0006: envelope schema numbered 3 to match the project

Status: accepted · 2026-09-07 · partially superseded by
[ADR-0009](adr-0009-v3-only-and-rawname.md) and
[ADR-0012](adr-0012-envelope-version-is-a-major-minor-string.md)

The number `3` stands, as the **major**. The half of this record that
says `1` stays accepted on import — and the `ACCEPTED_SCHEMA_VERSIONS`
set that implemented it — is superseded: upload reads major 3 only, and
old files are converted offline with `npm run convert:v3`. Its "a plain
integer, not semver" is superseded too: the field is the string
`"major.minor"` (`"3.1"` today), because an integer cannot say which
version of the format a file was written under, and a JSON number
cannot tell `3.10` from `3.1`. The argument for a single number — a
reader has one question — survives as the rule for the **major**.

## Context

The interchange envelope carried `"schema": 1` — the first version
of a format that only ever existed inside project-bloodtests-v3.
The number was therefore read wrong every time it was seen: a file
stamped `1` in a v3 repo looks like a v1 file, and the question
"is this an old export?" came up for a file that was current.

The format has never had a breaking change, so the number carried
no information the reader needed anyway: there is exactly one
shape, and [`schema`](../interchange-format.md#schema) exists to
answer *can I read this?*, not *how old is this?*

Files already stamped `1` are in the wild and cannot be rewritten:
past exports on people's disks, the gitignored share-link payloads
under `web/public/d/`, and local dev data.

## Decision

**The current envelope version is `3`, matching the project
version; `1` stays accepted on import.** The two numbers name the
same format — the jump is an alignment, not a format change, and
nothing about the shape changed with it. `2` was never issued and
is rejected like any other unexpected number, i.e. the envelope
isn't recognised and the file falls through to the "unrecognized
JSON shape" error.

Both facts live in one module, `web/src/data/envelopeSchema.ts`:
`SCHEMA_VERSION` (what the exporter stamps and the chatbot prompt
instructs) and `ACCEPTED_SCHEMA_VERSIONS` (`{1, 3}`, what the
upload parser accepts). Neither side repeats a literal.

## Consequences

- Old files keep importing untouched; no migration, no rewrite of
  the share-link payloads.
- The accepted set only grows, so it records the format's history
  — a future breaking change bumps `SCHEMA_VERSION` and decides,
  separately, whether the previous number stays in the set.
- Version alignment is now a convention: if the project ever
  reaches v4 without a format change, the tempting move is another
  free bump, which would cost an entry in the accepted set for no
  reader benefit. Alignment was worth doing once, to stop `1` from
  misleading; it is not a rule to repeat per project version.

(Superseded, all three: the accepted set is gone, old files are
converted rather than read in place, and the breaking change that
"would force revisiting" arrived as
[ADR-0009](adr-0009-v3-only-and-rawname.md).)

## What would force revisiting

- A genuinely breaking format change, which bumps the number for
  its real reason and decouples it from the project version again.
- The accepted set growing past a couple of entries, at which
  point per-version read paths — rather than one shape read by
  every accepted number — become the real design question.
