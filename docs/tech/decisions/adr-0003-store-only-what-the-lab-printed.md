# ADR-0003: store only what the lab printed, no `us` / `si` blocks

Status: accepted · 2026-08-27

## Context

The inherited canonical shape — v2's `engine/src/schema.ts`,
ported to v3's `drawsSchema.ts` — requires all three of
`original`, `us` and `si` for every item: the lab's value plus
two converted representations. v3 reads only `original` and
discards the other two.

Files built from the converted layer were therefore carrying
derived numbers in the position where a measurement is expected,
with reference text regenerated from converted bounds. A real
share payload was built this way and shows converted values
rather than the ones the lab printed.

## Decision

**The interchange format stores only what the lab reported** —
[`value`](../interchange-format.md#value),
[`unit`](../interchange-format.md#unit) and reference text as
printed. No `us` / `si` sibling blocks, no conversion at rest;
see [No `us` / `si` sibling
blocks](../interchange-format.md#no-us--si-sibling-blocks).

A derived number sitting beside a measurement is eventually read
as a measurement. Unit conversion is a presentation concern and
belongs at display time, where it is visibly a conversion. Fewer
required fields also makes a hand-written file valid.

## Consequences

- Converting at display time needs a units mapping in the app,
  which the format does not carry.
- Anything already generated from the converted layer must be
  rebuilt from source; existing payloads are not silently
  correct.
- Revisit when a consumer appears that cannot convert and
  requires a specific unit system at rest.
