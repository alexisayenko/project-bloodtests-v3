# Content

Reference data about the *subject* of the project — quantities,
lists, source corpora, glossaries, and editorial reference
material that drives the catalog or product output. Verify
against primary sources before launch.

Editorial copy that ships in the product (microcopy, in-app
strings, marketing) lives with its code folder —
`<folder>/content/`
or `brand/`. This folder is for the *source material* the product
is built from.

## Common slots

Don't pre-create — extract on first real entry. See
[Section, file, folder](../README.md#section-file-folder).

- **`[TODO: top-level subject — e.g. paintings.md, garments.md]`**
  — the primary corpus.
- **`sources.md`** — bibliography / canonical sources for factual
  claims (with licensing notes per source).
- **`prompts/`** — prompt sources for AI-assisted content
  generation.
- **`motifs.md`** / **`themes.md`** / **`taxonomy.md`** —
  categorizations and groupings.

For per-product domain nouns, see
[`../product/concepts/`](../product/concepts/) — those are
durable entities the product reasons about, not source corpora.
For doc-meta vocabulary (Section, Concern, …), see
[`../README.md#glossary`](../README.md#glossary).

## Open questions

- [TODO: open editorial decisions awaiting resolution.]
