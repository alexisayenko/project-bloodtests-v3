# ADR-0001: `contentHash` over plain `JSON.stringify`, not a canonical serialization

Status: accepted · 2026-08-27

## Context

The interchange envelope carries an optional `contentHash` —
see [`interchange-format.md`](../interchange-format.md#contenthash).
It exists for **change detection** (*has this file changed since
I imported it?*), not corruption protection: HTTPS and
`JSON.parse` already cover transport integrity.

`JSON.stringify` hashes the *text*, not the meaning — the same
data with keys in a different order produces a different hash.
That is tolerable while a single converter, emitting a stable key
order, writes every file. It breaks the moment a second writer
appears, a file is hand-reformatted, or a library that reorders
keys enters the path.

The alternative is canonicalizing before hashing — recursively
sorting keys and fixing number formatting — standardized as JCS,
[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785).

## Decision

**`contentHash` is `sha256:` plus lowercase hex of
`JSON.stringify(diagnosticReports)`** — plain serialization, not a
canonical one.

The failure mode is benign: a false "changed" costs one
unnecessary re-import. Canonicalization costs a dependency and an
invariant that must never be broken, to buy nothing today. If it
ever becomes necessary it is a one-line change plus a `schema`
bump.

## Consequences

- Two semantically identical files can hash differently; readers
  must treat a hash mismatch as "re-import", never as "corrupt".
- The hash is not an identity or deduplication key.
- Revisit when any of these appears: a second independent writer
  of these files, files edited by hand or by a formatter, or a
  use of the hash for integrity or deduplication rather than
  change detection.
