import type { ReactNode } from 'react';
import { COLOR } from '../../styles/tokens';
import { LoincLink } from './parts';

const FSH_LOINC = '15067-2';
const FSH_LOINC_PART = 'LP14499-5';
const FSH_WRONG_CID = '62819';
const FSH_SOURCES_RETRIEVED = '2026-09-12';

function ReferenceRow({ label, href, note }: Readonly<{ label: string; href: string; note: ReactNode }>) {
  return (
    <div style={{ marginBottom: 12, fontSize: 14 }}>
      <a href={href} target="_blank" rel="noreferrer" style={{ color: COLOR.accent, fontWeight: 600 }}>
        {label}
      </a>
      <div style={{ fontSize: 13, color: COLOR.textMuted, marginTop: 2, maxWidth: 640 }}>{note}</div>
    </div>
  );
}

/** A visible, always-rendered attribution block — not a tooltip — for an image whose licence requires the credit to reach the reader. */
function ImageAttribution({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 12px',
        borderLeft: `3px solid ${COLOR.accent}`,
        background: COLOR.surfaceMuted,
        borderRadius: '0 8px 8px 0',
        fontSize: 12.5,
        color: COLOR.textSecondary,
        lineHeight: 1.55,
        maxWidth: 480,
      }}
    >
      {children}
    </div>
  );
}

export function FshPage() {
  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>FSH</h1>
      <div style={{ fontSize: 15, fontWeight: 600, color: COLOR.textSecondary, marginBottom: 8 }}>
        Follicle-Stimulating Hormone
      </div>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 24, maxWidth: 720 }}>
        An illustrative look at one analyte's identity — where it's defined, and why a hormone this size resists
        most of the ways a molecule normally gets written down. Below, FSH is also the vehicle for a real mistake
        caught along the way: a PubChem record that lists "Follicle-stimulating hormone" as a synonym while
        depicting a molecule roughly thirty times too small to be it.
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>References</h2>
      <ReferenceRow
        label="Follicle-stimulating hormone — Wikipedia"
        href="https://en.wikipedia.org/wiki/Follicle-stimulating_hormone"
        note="General identity, physiology and structure."
      />
      <div style={{ marginBottom: 12, fontSize: 14 }}>
        <span style={{ color: COLOR.text, fontWeight: 600 }}>LOINC Part </span>
        <LoincLink loinc={FSH_LOINC_PART} />
        <div style={{ fontSize: 13, color: COLOR.textMuted, marginTop: 2, maxWidth: 640 }}>
          The component-level concept for follitropin.
        </div>
      </div>
      <div style={{ marginBottom: 12, fontSize: 14 }}>
        <span style={{ color: COLOR.text, fontWeight: 600 }}>LOINC </span>
        <LoincLink loinc={FSH_LOINC} />
        <div style={{ fontSize: 13, color: COLOR.textMuted, marginTop: 2, maxWidth: 640 }}>
          The test-level code this app's own catalog actually uses for FSH — "Follitropin [Units/volume] in Serum
          or Plasma".
        </div>
      </div>
      <ReferenceRow
        label={`PubChem CID ${FSH_WRONG_CID}`}
        href={`https://pubchem.ncbi.nlm.nih.gov/compound/${FSH_WRONG_CID}`}
        note="The record commonly found when searching PubChem for FSH — see the note below on why it's misleading."
      />

      <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 10 }}>
        Different types of molecular notation
      </h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 20, maxWidth: 720 }}>
        A steroid like testosterone or estradiol is small and fixed enough to be written several equivalent ways —
        a formula, a 2D diagram, a short machine-readable string — and each one names exactly the same handful of
        atoms every time. FSH is not that kind of molecule: it's a roughly 30,000-dalton glycoprotein assembled from
        two peptide chains and variable sugar trees, and most of those small-molecule notations simply have nothing
        to attach to.
      </p>

      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Amino-acid sequence and subunit composition</h3>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        This is FSH's real "formula": a heterodimer of two peptide chains, non-covalently associated. The common
        α-subunit is identical across FSH, LH, TSH and hCG — the shared glycoprotein hormone alpha chain — while an
        FSH-specific β-subunit gives the hormone its own receptor specificity. Four asparagine residues carry
        N-linked glycosylation (αAsn52, αAsn78, βAsn7, βAsn24), each with a documented functional role in folding,
        stability, secretion, receptor binding, signal transduction or circulatory half-life.
      </p>
      <img
        src="/reference/fsh/fsh-subunit-glycosylation.jpg"
        alt="Figure 1 from Lispi et al. 2023 showing the FSH alpha and beta subunits and their four glycosylation sites"
        width={420}
        height={374}
        style={{ border: `1px solid ${COLOR.borderSubtle}`, borderRadius: 8, background: '#fff', display: 'block' }}
      />
      <ImageAttribution>
        Figure 1 from Lispi M, Humaidan P, Bousfield GR, D'Hooghe T, Ulloa-Aguirre A. "Follicle-Stimulating Hormone
        Biological Products: Does Potency Predict Clinical Efficacy?" <i>Int J Mol Sci.</i> 2023;24(10):9020. DOI:{' '}
        <a href="https://doi.org/10.3390/ijms24109020" target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
          10.3390/ijms24109020
        </a>
        . © 2023 the authors; licensee MDPI, Basel, Switzerland. Distributed under the terms of the{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
          style={{ color: COLOR.accent }}
        >
          Creative Commons Attribution (CC BY 4.0) licence
        </a>.
      </ImageAttribution>

      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 8px' }}>3D structure (cartoon representation)</h3>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        A cartoon rendering of the folded protein is the notation that scales to something this size: it shows the
        hormone's actual three-dimensional shape, docked against its receptor, rather than trying to enumerate every
        atom.
      </p>
      <img
        src="/reference/fsh/fsh-1xwd-structure.png"
        alt="Cartoon structure of human FSH (green alpha subunit, brown beta subunit) bound to its receptor (blue), PDB 1XWD"
        width={320}
        height={331}
        style={{ border: `1px solid ${COLOR.borderSubtle}`, borderRadius: 8, background: '#fff', display: 'block' }}
      />
      <ImageAttribution>
        Crystal structure of human FSH (green α-subunit, brown β-subunit) complexed with the extracellular domain of
        its receptor (blue). PDB entry{' '}
        <a href="https://www.rcsb.org/structure/1XWD" target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
          1XWD
        </a>
        , Fan QR &amp; Hendrickson WA. Image:{' '}
        <a
          href="https://commons.wikimedia.org/wiki/File:Human_Follicle_Stimulating_Hormone_Complexed_with_its_Receptor_1XWD.png"
          target="_blank"
          rel="noreferrer"
          style={{ color: COLOR.accent }}
        >
          Wikimedia Commons
        </a>
        , released under{' '}
        <a
          href="https://creativecommons.org/publicdomain/zero/1.0/"
          target="_blank"
          rel="noreferrer"
          style={{ color: COLOR.accent }}
        >
          CC0
        </a>{' '}
        — no attribution is legally required, credited here as good practice.
      </ImageAttribution>

      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 8px' }}>SMILES / InChI</h3>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        These are linear, machine-readable strings built for small molecules; they are technically definable for a
        peptide of any length but are essentially never used for a protein this size — nobody writes out a
        30,000-dalton glycoprotein as one line of SMILES.
      </p>

      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 8px' }}>Schematic / textbook icon</h3>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 24, maxWidth: 720 }}>
        A plain labeled shape is often the practical choice for a diagram node precisely because none of the
        notations above scale down to icon size, or apply at all — which is what a compact diagram, like this app's
        Hormonal Pathways page, actually uses.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Sources</h2>
      <div style={{ fontSize: 13, color: COLOR.textSecondary, lineHeight: 1.7, maxWidth: 720 }}>
        <div>Follicle-stimulating hormone. Wikipedia, the Free Encyclopedia.</div>
        <div>LOINC Part {FSH_LOINC_PART} and LOINC {FSH_LOINC}. Regenstrief Institute.</div>
        <div>
          PubChem Compound Summary for CID {FSH_WRONG_CID} — cited above as the mislabeled record, not as a
          correct depiction of FSH.
        </div>
        <div>
          Lispi M, Humaidan P, Bousfield GR, D'Hooghe T, Ulloa-Aguirre A. Follicle-Stimulating Hormone Biological
          Products: Does Potency Predict Clinical Efficacy? Int J Mol Sci. 2023;24(10):9020. DOI:
          10.3390/ijms24109020 — CC BY 4.0.
        </div>
        <div>
          Fan QR, Hendrickson WA. Structure of human follicle-stimulating hormone in complex with its receptor.
          Nature. 2005;433:269–277 (PDB 1XWD). Image via Wikimedia Commons — CC0.
        </div>
      </div>
      <p style={{ fontSize: 13, color: COLOR.textMuted, marginTop: 8, maxWidth: 720 }}>
        All retrieved {FSH_SOURCES_RETRIEVED}.
      </p>
    </div>
  );
}
