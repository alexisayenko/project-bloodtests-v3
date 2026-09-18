# ADR-0022: Illustrative artwork and data-drawn glyphs coexist

Status: accepted · 2026-09-16

> **Amended 2026-09-16 ([task-0062](../../tasks/task-0062.md)).** The
> data-drawn glyphs this record describes — `LipidParticleGlyph.tsx`,
> `lipidArtwork.ts`, `lipidParticleGeometry.ts`, `web/src/assets/lipids/*.svg`
> and `lipid-artwork.test.ts`, with the Artwork / Data switch — were retired
> when Lipid Transport was redrawn as a holder-plus-cargo diagram. The
> principle survives unchanged: a bubble's TRIG and Chol cargo is encoded as
> the **count** of identical circles in its `CompoundStack`, every circle at
> one fixed size whatever icon fills it, so no artwork's shape or area is read
> as a quantity, and the counts are stated on the page as illustrative rather
> than scaled to the sourced shares. The file names below are history.

## Context

The [pathway](../../product/concepts/pathway.md) concept's icon rule, written
2026-09-11, said ChatGPT, stock and AI images are inspiration only, never
shipped. The pages outgrew it:

- **Hormonal Pathways** ships `web/public/pathways/brain-pituitary.png`,
  generated in ChatGPT by Alex, and `leydig-cells.png`, cropped from a mockup
  ([task-0024](../../tasks/task-0024.md)).
- **Lipid Transport** ([task-0060](../../tasks/task-0060.md)) ships six
  ChatGPT-generated particle SVGs Alex supplied
  (`web/src/assets/lipids/*.svg`, text and background stripped). Each has a
  yellow and a teal area that *look* like triglyceride and cholesterol shares,
  and are not: they were drawn, not computed.
- **The key principle** is that nothing the app shows is invented. A picture of
  a brain claims nothing; a filled area inside a particle outline reads as a
  proportion, and an unsourced proportion is an invented figure.
- **The mockups already got biology wrong** (ADR-0014's context), so artwork
  cannot be where wiring or quantities come from either.

## Decision

**Generated or hand-supplied artwork may ship as illustration. Any geometry
that encodes a quantity is drawn by the app from cited reference data, and
where no source exists the shape stays empty and says so.**

- **Illustration is allowed.** An organ, a cell, an enzyme or a particle may be
  artwork, whatever made it, when it stands for *what* a node is, not *how much*
  of anything there is. It never stands in for a real structure (a PDB model)
  or for wiring.
- **Artwork that looks like data is labelled on the page.** Lipid Transport's
  default Artwork mode says "Icon fill areas are illustrative; the table below
  has the sourced shares", and both modes say sizes show diameter order, not
  scale.
- **Data-drawn glyphs compute their geometry.** Data mode
  (`LipidParticleGlyph.tsx`) draws each particle's TRIG and Chol regions as
  shares of the area inside its shell, equal to the midpoint of the sourced
  mass shares in `web/public/data/lipoprotein-particles.json` (closed schema,
  every figure as its source printed it and citing a retrieved source), solved
  by `lipidParticleGeometry.ts`'s `organicRegions`; `reference-data.test.ts`
  holds each solved region within one percentage point of the share asked for.
- **Unsourced stays empty.** A particle with no sourced composition (IDL,
  Lp(a)) draws no regions and shows "composition not sourced"; its association
  rings fall back to the whole particle rather than to an invented area.
- **Artwork serves the same interaction.** `lipidArtwork.ts` tags the SVGs'
  areas and pills with `data-node` so badges can ring them as in Data mode;
  `lipid-artwork.test.ts` keeps the files tagged and free of text and script.

## Alternatives considered

- **Keep "inspiration only".** Every node would wait on hand-drawn SVG, and
  the drawn result would be no truer — only slower.
- **Artwork only, relabelled as approximate.** "Approximate" still invites a
  reader to read the areas; a figure with no source is not approximately
  anything.
- **Data only.** Correct, and it leaves IDL and Lp(a) as empty outlines today;
  the artwork shows what the particles are while their composition is unsourced.
- **Scale artwork areas to the data.** Distorting a supplied drawing to match a
  figure mixes the two kinds and makes neither trustworthy.

## Consequences

- The pathway concept's icon section no longer bans shipped artwork; it states
  this rule instead.
- Lipid Transport carries two modes behind an unpersisted "Particles" switch,
  defaulting to Artwork, and a note that changes with the mode.
- A new quantity-bearing shape needs a data file, a schema, citations and a
  geometry test before it is drawn; a new illustration needs none of these.
- The Hormonal Pathways page labels its brain and cell images anyway, in the
  same muted `ArtworkNote` Lipid Transport uses ("The brain and cell images are
  illustrative."). They encode no quantity, so the rule does not require it;
  their provenance is recorded in task-0024.
- Sizes follow a stated ordinal rule (level of organisation, or diameter order
  on the particle row), never an unsourced scale, whichever mode draws them.

## What would force revisiting

- Artwork whose geometry would be read as a quantity and cannot be labelled
  clearly enough — then it must go, or be drawn from data.
- A sourced composition for IDL or Lp(a), which removes the gap Data mode
  shows today, and may make Artwork mode unnecessary as the default.
- A licence or provenance question about generated artwork in a public repo.
