import { MARKER_LOINC, SI_US_UNIT } from '../../data/computedIndices';
import {
  CYRILLIC_TO_LATIN,
  LATIN_TOKENS,
  checkCodeUnit,
  dimensionOf,
  sameUnitScale,
  toLatinUnit,
  toUcum,
  unitScaleFamilies,
} from '../../data/unitNormalization';
import { MASS_MOLAR_SIBLINGS } from '../../data/massMolarSiblings';
import { ALLOWED_UNITS, ANALYTE_BY_LOINC, DEFAULT_UNITS, loincsFoldingUAndIu, SHORT_NAMES } from '../../data/analyteCatalog';
import { COLOR } from '../../styles/tokens';
import type { Route } from '../conditions/routing';
import { TABLE, pressable } from '../primitives/styles';
import { td, th } from './cells';
import { EM_DASH, Mono, Scroller } from './parts';

const PRINTED_EXAMPLES = ['ммоль/л', 'мкМЕ/мл', '×10⁹/L', 'тыс/мкл', 'mcg/dL', 'МО/л', 'mmol/l'];

const CATALOG_UNITS = [...Object.values(DEFAULT_UNITS), ...Object.values(ALLOWED_UNITS).flat()];

const UNIT_FAMILIES = unitScaleFamilies(CATALOG_UNITS);

const READABLE_CATALOG_UNITS = new Set(CATALOG_UNITS.map((unit) => toLatinUnit(unit)).filter(Boolean));

const GLUCOSE_SIBLING = MASS_MOLAR_SIBLINGS.find((pair) => pair.mass.loinc === '2345-7') ?? MASS_MOLAR_SIBLINGS[0];

// Every verdict in the table is computed against these codes, so the page cannot claim behaviour the code lacks.
const ALT_LOINC = '1742-6';
const INSULIN_LOINC = '20448-7';

const ENZYME_UNIT_EXAMPLES = ['U/L', 'IU/L', 'Ед/л', 'МЕ/л'];
const HORMONE_UNIT_EXAMPLES = ['µU/mL', 'µIU/mL', 'мкЕд/мл', 'мкМЕ/мл'];

const CATALYTIC_FOLD_LOINCS = loincsFoldingUAndIu('catalytic-activity');
const ARBITRARY_FOLD_LOINCS = loincsFoldingUAndIu('arbitrary-unit');

interface UnitSource {
  authority: string;
  document: string;
  url: string;
  detail?: string;
  supports: string;
}

// Clinical Chemistry and the LOINC Users' Guide refuse automated fetchers, so they are linked rather than quoted.
const SOURCES_RETRIEVED = '2026-09-09';

const UNIT_SOURCES: UnitSource[] = [
  {
    authority: 'Regenstrief Institute / UCUM Organization',
    document: 'The Unified Code for Units of Measure, version 2.2 (2024-06-17)',
    url: 'https://ucum.org/ucum',
    detail: 'Gunther Schadow, Clement J. McDonald',
    supports:
      'The vocabulary this app normalizes toward, and — in §§24–25, "Arbitrary Units" — the declaration that [IU] is arbitrary and commensurable with nothing, while U is exactly 1 µmol/min.',
  },
  {
    authority: 'Regenstrief Institute',
    document: 'UCUM Copyright Notice and License, Version 1.1, June 2024',
    url: 'https://ucum.org/license',
    detail: '© 1999–2024 Regenstrief Institute, Inc. — a custom licence, not Creative Commons',
    supports:
      'Permits reproducing and distributing the work and building software that interoperates with it; forbids derivative works and any modification of its content; requires attribution. This app displays UCUM codes, so the notice belongs here.',
  },
  {
    authority: 'World Health Organization',
    document:
      'Technical Report Series No. 932 (2006), Annex 2 — Recommendations for the preparation, characterization and establishment of international and other biological reference standards (revised 2004)',
    url: 'https://cdn.who.int/media/docs/default-source/biologicals/documents/trs932annex-2-inter-biol-standards-rev2004.pdf',
    supports:
      'An International Unit is assigned to a reference preparation in an arbitrary manner, one preparation at a time — which is why one analyte’s IU says nothing about another’s.',
  },
  {
    authority: 'Clinical Chemistry (ADLM / Oxford University Press)',
    document: 'Instructions to Authors, General Instructions',
    url: 'https://academic.oup.com/clinchem/pages/General_Instructions',
    supports:
      'Treats units differing "by only a factor of 1000 in both the numerator and denominator (e.g., ng/mL vs µg/L)" as one unit in practice, and states that U/L is used for most enzyme activities.',
  },
  {
    authority: 'Regenstrief Institute',
    document: 'LOINC Users’ Guide, §2.3 "Kind of Property"',
    url: 'https://loinc.org/kb/users-guide/major-parts-of-a-loinc-term/property',
    supports:
      'Mass-numerator units imply a Mass property, mole and mEq units a Substance property, and enzymatic units a Catalytic activity property — the third stage’s check, and the field this page reads to tell an enzyme from a hormone.',
  },
];

function UnitSourceItem({ source }: Readonly<{ source: UnitSource }>) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, color: COLOR.text }}>
        <span style={{ fontWeight: 600 }}>{source.authority}</span>
        {' — '}
        <a href={source.url} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
          {source.document}
        </a>
        {source.detail && <span style={{ color: COLOR.textMuted }}> · {source.detail}</span>}
      </div>
      <div style={{ fontSize: 13, color: COLOR.textSecondary, lineHeight: 1.55, marginTop: 4 }}>
        {source.supports}
      </div>
    </div>
  );
}

function markerName(marker: string): string | undefined {
  const loinc = MARKER_LOINC[marker]?.[0];
  return loinc ? ANALYTE_BY_LOINC[loinc]?.friendlyName : undefined;
}

export function UnitsPage({ navigate }: Readonly<{ navigate: (r: Route) => void }>) {
  const mismatch = checkCodeUnit(GLUCOSE_SIBLING.mass.loinc, toUcum(GLUCOSE_SIBLING.molar.unit) ?? GLUCOSE_SIBLING.molar.unit);

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Units and how they are read</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 24, maxWidth: 720 }}>
        Every lab prints its units its own way. What the app does with the string it finds — and, more importantly,
        what it never does to the number beside it.
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>One unit, many spellings</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        A report from one year says <Mono>mmol/L</Mono>, the next says <Mono>mmol/l</Mono>, and one from another
        country says <Mono>ммоль/л</Mono>. All three are the same unit and none of them is equal to the others as a
        string. Left alone, that splits one marker into several series on a chart, and makes any comparison across
        years a matter of luck in spelling.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 20, maxWidth: 720 }}>
        So the app reads each printed unit into a canonical form. Reading is all it is: the string the lab printed
        stays exactly as printed, and the number beside it is never touched.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>The target vocabulary: UCUM</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        UCUM — the Unified Code for Units of Measure, published by the Regenstrief Institute — is the vocabulary the
        app normalizes toward. It gives every unit one machine-readable code: <Mono>mmol/L</Mono> is{' '}
        <Mono>mmol/L</Mono>, an international unit per litre is <Mono>[IU]/L</Mono>, and a count of a thousand per
        microlitre is <Mono>10*3/uL</Mono>. LOINC publishes example UCUM units for its codes, and the interchange
        format this app reads and writes is FHIR-shaped, where a quantity's code is expected to be UCUM — so
        choosing anything else would mean deviating from the shapes already borrowed. UCUM is published by the
        Regenstrief Institute under a licence of its own, which allows software to interoperate with it and to
        reproduce it with attribution, and forbids modifying its content; the codes shown throughout this app are
        used unaltered on those terms.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 20, maxWidth: 720 }}>
        UCUM is an expression grammar rather than a fixed list, so a perfectly valid unit can be written that no
        lookup table anticipated. What the app carries is a curated subset — {Object.keys(LATIN_TOKENS).length} unit
        tokens and {Object.keys(CYRILLIC_TO_LATIN).length} Cyrillic and Ukrainian spellings of them — not a parser.
        A unit outside it is reported as unreadable rather than guessed at, which is itself a mild warning on the
        report: those are the rows whose spellings the tables still need to learn.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Three stages</h2>
      <div
        style={{
          fontSize: 13.5,
          fontFamily: 'monospace',
          background: COLOR.surfaceMuted,
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 12,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        printed unit → canonical Latin spelling → UCUM code → does it fit the test code?
      </div>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        The first stage does the messy part. It folds the glyphs a lab keyboard reaches for — superscript exponents
        (<Mono>×10⁹/L</Mono> becomes <Mono>10^9/L</Mono>), the micro sign and Greek mu (µ, μ → <Mono>u</Mono>), the
        multiplication signs including the Cyrillic <Mono>х</Mono> — then splits the unit on its slash and looks up
        each part in turn, in the Latin table or in the Cyrillic one. Case and stray whitespace stop mattering
        there; so does the two-letter <Mono>mc</Mono> prefix some labs use for micro. The second stage is a
        straight lookup from that Latin spelling to the UCUM code. The third asks a different kind of question,
        below.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        Every row below is computed by the same functions the importer calls, on the spelling in its first column:
      </p>
      <Scroller>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={th}>As printed</th>
              <th style={th}>Latin spelling</th>
              <th style={th}>UCUM</th>
              <th style={th}>Dimension</th>
            </tr>
          </thead>
          <tbody>
            {PRINTED_EXAMPLES.map((printed) => {
              const latin = toLatinUnit(printed);
              return (
                <tr key={printed}>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{printed}</td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{latin ?? EM_DASH}</td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{(latin && toUcum(latin)) ?? EM_DASH}</td>
                  <td style={{ ...td, color: COLOR.textSecondary }}>{dimensionOf(printed) ?? EM_DASH}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Scroller>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 20, maxWidth: 720 }}>
        The third stage compares that unit's dimension — what kind of quantity it measures — against what the test
        code says it should be measuring, using the units the analyte catalog allows for that code. It is a check,
        not a repair: it can say that a unit and a code disagree, and it says so without altering either.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Units that are the same unit</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        Some spellings are not merely similar — they are one unit written twice. A thyrotropin result printed{' '}
        <Mono>uIU/mL</Mono> and the same result printed <Mono>mIU/L</Mono> are the identical quantity: a millionth
        of an international unit in a thousandth of a litre is a thousandth of one in a whole litre. Recognising
        that is what lets a history spanning three labs carry one unit label above the row instead of a label on
        every cell — and it does so without converting anything, because there is nothing to convert.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        The test is arithmetic, not a list: two spellings match when their parts are the same kinds of quantity in
        the same order and the ratio of their scales is exactly one. Anything else — <Mono>mg/dL</Mono> against{' '}
        <Mono>g/L</Mono>, or against <Mono>mmol/L</Mono> — shares a dimension but not a scale, and is kept apart.
        These are the families that come out of the {READABLE_CATALOG_UNITS.size} readable units the analyte
        catalog actually uses; a unit added to the catalog tomorrow joins one of them, or starts its own, with
        nothing here to update.
      </p>
      <Scroller>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={th}>Spellings of one unit</th>
              <th style={th}>UCUM</th>
              <th style={th}>Dimension</th>
            </tr>
          </thead>
          <tbody>
            {UNIT_FAMILIES.map((family) => (
              <tr key={family.join('|')}>
                <td style={{ ...td, fontFamily: 'monospace' }}>{family.join('  =  ')}</td>
                <td style={{ ...td, fontFamily: 'monospace', color: COLOR.textSecondary }}>
                  {family.map((unit) => toUcum(unit) ?? unit).join('  =  ')}
                </td>
                <td style={{ ...td, color: COLOR.textSecondary }}>{dimensionOf(family[0]) ?? EM_DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroller>
      <p style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 24, maxWidth: 720 }}>
        A unit with no computable scale — a percentage, a cell count per microlitre, a bare "Positive/Negative" —
        can never be in a family here, because there is no scale to compare. Those readings keep their own label.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>When U and IU are one unit</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        One pair of spellings does not answer to arithmetic alone. Labs print both <Mono>U</Mono> and{' '}
        <Mono>IU</Mono>, and whether those are one unit depends on what is being measured. There are two units in
        play. One is the enzyme unit the biochemists defined in 1964 — the amount converting one micromole of
        substrate a minute — and its name is <Mono>U</Mono>. The other is the World Health Organization's
        international unit, whose size is fixed against a particular reference preparation of a particular
        substance and in an arbitrary manner, and its name is <Mono>IU</Mono>. They are nothing like each other:
        FSH's IU and hCG's IU are not the same size as one another, let alone as a micromole per minute.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        What makes the spellings tractable is that an analyte is measured in one of those units, not both — so
        whichever name a lab printed, there is only one unit it can have meant, and the loose spelling folds onto
        the strict one. It happens in both directions, and neither is a special case of the other. An enzyme is
        measured in the 1964 unit, so its printed <Mono>IU/L</Mono> is <Mono>U/L</Mono>: the "international"
        there is a habit of typography, not a WHO preparation. A hormone standardised by the WHO is measured in
        the international unit, so its printed <Mono>µU/mL</Mono> is <Mono>µIU/mL</Mono>: the "I" was dropped, not
        the meaning. Insulin is the case in the owner's own data, printed both ways by the same lab across one
        decade.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        UCUM records the two units strictly: <Mono>U</Mono> is defined as 1 µmol/min, while <Mono>[IU]</Mono>{' '}
        sits among its arbitrary units and is declared commensurable with nothing at all — not even with another
        <Mono> [IU]</Mono>. Taken literally that would keep one analyte's own two spellings apart on a row where a
        lab plainly meant one thing, so this app deviates in exactly one place: where the analyte's LOINC property
        names one of the two units — a catalytic activity, or the "Units/volume" LOINC gives the arbitrary ones —{' '}
        <Mono>U</Mono> and <Mono>[IU]</Mono> are the same scale for that analyte. Under any other property, and
        wherever the analyte is not known at all, they are not. The strictness UCUM is protecting survives intact:
        one analyte's IU still never meets another's.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        The deviation is narrow because nothing is converted by it. All it decides is whether one unit label may
        stand above a row or whether each cell carries its own — the numbers on screen are the numbers the labs
        printed either way, so the worst a mistake here could do is print a redundant label. And the question is
        never asked of the strings: it is asked of the analyte catalog, which records LOINC's own Kind of Property
        for every code. {CATALYTIC_FOLD_LOINCS.length} of the app's codes are catalytic activities and{' '}
        {ARBITRARY_FOLD_LOINCS.length} are filed under "Units/volume"; every other code permits neither fold, and
        nothing needs to be listed by hand.
      </p>
      <Scroller>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={th}>Two spellings</th>
              <th style={th}>Enzyme ({SHORT_NAMES[ALT_LOINC]?.shortName ?? 'ALT'})</th>
              <th style={th}>Hormone ({SHORT_NAMES[INSULIN_LOINC]?.shortName ?? 'INS'})</th>
              <th style={th}>Analyte unknown</th>
            </tr>
          </thead>
          <tbody>
            {[
              [ENZYME_UNIT_EXAMPLES[0], ENZYME_UNIT_EXAMPLES[1]],
              [ENZYME_UNIT_EXAMPLES[2], ENZYME_UNIT_EXAMPLES[3]],
              [HORMONE_UNIT_EXAMPLES[0], HORMONE_UNIT_EXAMPLES[1]],
              [HORMONE_UNIT_EXAMPLES[2], HORMONE_UNIT_EXAMPLES[3]],
              ['U/L', 'mIU/L'],
            ].map(([a, b]) => (
              <tr key={`${a}|${b}`}>
                <td style={{ ...td, fontFamily: 'monospace' }}>
                  {a} vs {b}
                </td>
                <td style={{ ...td, color: COLOR.textSecondary }}>
                  {sameUnitScale(a, b, ALT_LOINC) ? 'one unit' : 'different scales'}
                </td>
                <td style={{ ...td, color: COLOR.textSecondary }}>
                  {sameUnitScale(a, b, INSULIN_LOINC) ? 'one unit' : 'different scales'}
                </td>
                <td style={{ ...td, color: COLOR.textSecondary }}>
                  {sameUnitScale(a, b) ? 'one unit' : 'different scales'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroller>
      <p style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 24, maxWidth: 720 }}>
        The plain decimal-prefix identities above — <Mono>mIU/mL</Mono> and <Mono>IU/L</Mono>, <Mono>µIU/mL</Mono>{' '}
        and <Mono>mIU/L</Mono>, <Mono>ng/mL</Mono> and <Mono>µg/L</Mono> — are untouched by any of this. They are
        the same base scaled by a thousand in both halves of the fraction, which is true whatever is being
        measured.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>The SI / US switch</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        Above the results tables sits a unit-system toggle. It is deliberately narrow: it changes the display of
        the {Object.keys(SI_US_UNIT).length} markers below, and nothing else. For those, the number shown and the
        unit shown always move together — a converted value is never left standing under the unit it was converted
        from. Every other marker keeps showing exactly what its lab reported, because inventing a conversion
        factor for it would be worse than leaving it alone.
      </p>
      <Scroller>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={th}>Marker</th>
              <th style={th}>SI</th>
              <th style={th}>US</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(SI_US_UNIT).map(([marker, units]) => (
              <tr key={marker}>
                <td style={td}>
                  <Mono>{marker}</Mono>
                  {markerName(marker) && <span style={{ color: COLOR.textMuted }}> · {markerName(marker)}</span>}
                </td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{units.si}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{units.us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroller>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 24, maxWidth: 720 }}>
        What the switch does not do: it does not edit anything. It is a preference about how a table is drawn,
        applied when the table is drawn, and it reaches only the tables that read values — the analysis tables and
        the "What's in range" chart. Nothing stored changes, nothing exported changes, and switching back leaves
        no trace.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>What is never converted</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        The value and the unit a laboratory printed are the record. They are stored exactly as they were read and
        are never rewritten — not to tidy a spelling, not to move a result onto a scale the app would prefer. A
        derived number sitting where a measurement is expected is eventually read as a measurement, and that is a
        mistake worth designing against rather than apologising for later.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        Everything normalization produces therefore lives <i>beside</i> the printed pair, clearly derived. Where a
        reading needs to be comparable across a history that changed units, a canonical form is computed in memory
        for that purpose and discarded afterwards. An export keeps both halves apart: the printed string goes to
        the report's <Mono>rawUnit</Mono> untouched, and the folded UCUM spelling goes to <Mono>unit</Mono> — and
        if the tables cannot place the printed unit, <Mono>unit</Mono> is left out entirely rather than filled with
        a string that would claim a normalization that never happened. No value is converted on the way out.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        The sharpest case is a unit that contradicts its test code. A LOINC code names the scale it is reported
        on, so a molar unit under a mass-concentration code is not a unit problem to be fixed by arithmetic — it is
        the wrong code. The app says so, and names the sibling code for the same analyte on the other scale:
      </p>
      {mismatch.kind === 'dimension-mismatch' && (
        <blockquote
          style={{
            margin: '0 0 12px',
            padding: '8px 14px',
            borderLeft: `3px solid ${COLOR.statusWarn}`,
            background: COLOR.surfaceMuted,
            borderRadius: '0 8px 8px 0',
            fontSize: 13,
            color: COLOR.textSecondary,
            lineHeight: 1.55,
          }}
        >
          {mismatch.note}
        </blockquote>
      )}
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, maxWidth: 720 }}>
        {MASS_MOLAR_SIBLINGS.length} analytes are paired that way. The arithmetic that connects the two scales is
        real and the app does hold it — for comparing readings, for placing a marker on its reference band, for
        computing an index whose formula wants one particular unit — but it is never a remedy for a mislabelled
        row.{' '}
        <span {...pressable(() => navigate({ view: 'reference', key: 'molar-masses' }))} style={{ color: COLOR.accent, cursor: 'pointer', fontWeight: 600 }}>
          Mass ↔ molar conversion
        </span>{' '}
        sets out where those numbers come from.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, margin: '24px 0 8px' }}>Sources</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 16, maxWidth: 720 }}>
        The rules on this page are somebody else's, not this app's. These are the documents they come from, and
        what each one settles.
      </p>
      {UNIT_SOURCES.map((source) => (
        <UnitSourceItem key={source.url} source={source} />
      ))}
      <p style={{ fontSize: 13, color: COLOR.textMuted, maxWidth: 720 }}>
        All five retrieved {SOURCES_RETRIEVED}.
      </p>
    </div>
  );
}
