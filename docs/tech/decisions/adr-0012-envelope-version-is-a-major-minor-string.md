# ADR-0012: The envelope version is a `"major.minor"` string

Status: accepted · 2026-09-09

Modifies [ADR-0009](adr-0009-v3-only-and-rawname.md)'s "`schema` accepts
`3` only" — the acceptance widens from the single number `3` to any
minor of major 3.

## Context

[ADR-0006](adr-0006-envelope-schema-numbered-3.md) chose a plain
integer for [`schema`](../interchange-format.md#schema), on the
argument that a reader has one question — *can I read this?* — and one
number answers it. That argument still holds, and it is the reason the
major stays a single number here.

What the integer cannot express is the other thing a version is for:
saying **which** version of the format a file was written under. The
rule that came with it — "bump only on a breaking change; adding an
optional field does not bump" — makes every non-breaking change
invisible. Two files both stamped `3` may or may not carry
[`rawUnit`](../interchange-format.md#rawunit), and nothing in either
file says which. A reader cannot tell, a bug report cannot cite it, and
the format's own history lives only in this repo's git log.

That has already happened once. [ADR-0007](adr-0007-ucum-as-the-unit-vocabulary.md)
made an observation's unit a pair — `unit` holding the printed spelling
folded to its UCUM code, `rawUnit` the string the lab printed — and the
exporter shipped it under the same `3` the previous shape carried.

If the version is going to carry a minor, it cannot be a JSON number.
`3.10` and `3.1` are the same number, so the tenth minor would silently
collide with the first. A version is an identifier, not a quantity.

## Decision

**`schema` is the string `"major.minor"`. The current value is
`"3.1"`.**

- **The major is the compatibility question**, unchanged from ADR-0006:
  major 3 is read, every other major is refused with the same single
  "Unrecognized JSON shape" error a legacy array shape gets. Only a
  breaking change — a field removed, renamed, or given a new meaning —
  bumps it.
- **The minor is bumped on every other change to the envelope format**,
  and every such change is a backward-compatible addition. Two
  directions, both required: a `3.0` file still loads under a reader
  written for `3.1` (a minor never removes anything), and a `3.2` file
  still loads under a reader that knows only `3.1` (the objects are
  open, and a reader ignores fields it does not know). A change that
  breaks either direction is not a minor — it is a major.
- **`3.1` is recorded retroactively**: the unit pair already shipped, so
  the first bump documents a change that is already in files on disk.
  The alternative is a version number whose history begins with a lie
  about what `3` meant.
- **The bare number `3` stays accepted, read as `3.0`.** It is what
  every file written before this decision carries, including share-link
  payloads, and refusing it would be a breaking change made purely to
  tidy the version field.
- **The bare string `"3"` is refused.** The string form always carries a
  minor; accepting a second spelling of the same version would put the
  ambiguity back in by hand.
- **The published schema keeps its major-only name**,
  `bloodtests-3.schema.json`, and its `$id` never moves. A minor is an
  addition, so one schema document validates 3.0, 3.1 and 3.2 files
  alike; a per-minor file name would break every reader that pinned the
  URL, for a document whose contents it can already validate. The
  `schema` property is constrained there to exactly the accepted forms —
  `const: 3`, or a string matching `^3\.(0|[1-9][0-9]*)$`.

## Alternatives considered

- **Keep the plain integer and bump it on every change.** Then a
  non-breaking addition and a breaking rename look identical to a
  reader, and the only safe response to either is to refuse the file —
  which turns every added optional field into a flag day.
- **Full semver, `"3.1.0"`.** The third part answers a question this
  format does not have: there is no such thing as a bug-fix release of a
  file's shape. It invites the comparison logic ADR-0006 rejected
  without paying for it.
- **A number `3.1`.** Reads naturally, and breaks on the tenth minor:
  JSON gives no way to distinguish `3.10` from `3.1`. This is the whole
  reason the field is a string.
- **A separate `formatRevision` field beside the integer `schema`.**
  Two version fields, and every writer free to disagree with itself
  about which one to bump.
- **Rename the schema file per minor.** Every published minor becomes a
  URL that must live forever, and a reader pinning one silently stops
  validating the files it is handed.

## Consequences

- **Export writes `"schema": "3.1"`.** A file this app writes is no
  longer byte-identical to one it wrote yesterday, and its
  `contentHash` is unaffected — the hash covers `diagnosticReports`
  only ([ADR-0001](adr-0001-content-hash-plain-stringify.md)).
- **Every existing file still imports**, stamped `3`, with no migration
  step. `npm run convert:v3` restamps whatever it converts to the
  current version, so a file passed through it comes out `"3.1"`.
- **The chatbot prompt asks for the string.** It is the format's only
  other producer, and it has to be told the quotes are part of the
  value.
- **ADR-0009's acceptance rule is widened, not reversed.** "One major,
  one comparison" survives; what changes is that the comparison is on
  the major of a two-part string rather than on the whole value.
- **The format now has a changelog with a home**: the minor history
  table in [`interchange-format.md`](../interchange-format.md#schema).
  Adding an optional field means adding a row there and bumping
  `SCHEMA_VERSION`, and forgetting to is the kind of omission a reviewer
  can see.
- Both offline scripts read any `3.x`. `convert-to-v3.mjs` restamps to
  the current version; `recode-molar.mjs` rewrites LOINC codes only and
  leaves the stamp exactly as it found it, since it does not change the
  file's shape.

## What would force revisiting

- A breaking change to the envelope — which is the major bump this
  scheme exists to keep distinct, and would make `bloodtests-4.schema.json`
  a new file rather than an edit of this one.
- A second producer of these files that pins a minor rather than a
  major, which would mean the forward-compatibility half of the rule is
  not being relied on and the version is being used as a gate.
