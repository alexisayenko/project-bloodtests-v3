import { useMemo, useState, type ReactNode } from 'react';
import {
  INDEX_UNIT_PAIRS,
  MARKER_LOINC,
  SI_US_UNIT,
  type IndexDef,
  type IndexReference,
} from '../../data/computedIndices';
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
import { INDEX_DEFS } from '../../data/indexDefs';
import {
  ATOMIC_WEIGHTS,
  ATOMIC_WEIGHTS_SOURCE,
  MOLAR_MASSES,
  MOLAR_MASS_BY_ID,
  massPerMolarUnit,
  molarPerMassUnit,
  type MolarMassEntry,
} from '../../data/molarMasses';
import { MASS_MOLAR_SIBLINGS } from '../../data/massMolarSiblings';
import { HP_AXIS_HTML } from './hpAxisContent';
import { greenRangeOf, namedLab, pressable } from './ui';
import {
  buildConditions,
  buildPanelsByLoinc,
  isEchoRedundant,
  observationMatchesQuery,
  panelMembershipOf,
  type Observation,
} from './markers';
import { sortAnalytes, sortedUnique, type AnalyteSortKey, type AnalyteSortValues, type SortDirection } from './analyteSort';
import { latestEntryByLoinc, type ResultEntry } from './resultsLookup';
import { routeToHash, type Route } from './routing';
import { COLOR } from '../../styles/tokens';
import { useData } from '../../data/DataContext';
import {
  ALLOWED_UNITS,
  ALSO_REFS,
  ANALYTES,
  ANALYTE_BY_LOINC,
  DEFAULT_UNITS,
  loincsFoldingUAndIu,
  SHORT_NAMES,
  SPECIMENS,
  trimmedLongName,
} from '../../data/analyteCatalog';
import type { Analysis } from '../../types';
import { BookOpen, Calculator, ShieldCheck } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { TABLE, TABLE_TD, TABLE_TH } from '../primitives/styles';

// Reference Book — one page per computed index, carrying the full clinical
// prose (meaning + evidence standing) and its cited sources with verbatim
// quotes, ported from project-bloodtests-v2's index catalog (ADR-0007).

const EVIDENCE_BADGE: Record<string, { background: string; color: string }> = {
  guideline: { background: COLOR.accentSoft, color: COLOR.accent },
  consensus: { background: COLOR.statusOkBg, color: COLOR.statusOkText },
  heuristic: { background: COLOR.statusWarnBg, color: COLOR.statusWarnText },
};

const BASIS_BADGE: Record<string, { background: string; color: string }> = {
  compound: { background: COLOR.statusOkBg, color: COLOR.statusOkText },
  element: { background: COLOR.accentSoft, color: COLOR.accent },
  conventional: { background: COLOR.statusWarnBg, color: COLOR.statusWarnText },
};

function Pill({ label, palette }: Readonly<{ label: string; palette?: { background: string; color: string } }>) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        ...(palette ?? { background: COLOR.surfaceMuted, color: COLOR.textSecondary }),
      }}
    >
      {label}
    </span>
  );
}

function EvidenceBadge({ level }: Readonly<{ level: string }>) {
  return <Pill label={level} palette={EVIDENCE_BADGE[level]} />;
}

function ReferenceItem({ source }: Readonly<{ source: IndexReference }>) {
  const link = source.url ?? (source.doi ? `https://doi.org/${source.doi}` : undefined);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, color: COLOR.text }}>
        <span style={{ fontWeight: 600 }}>{source.organization}</span>
        {source.year && <span style={{ color: COLOR.textMuted }}> ({source.year})</span>}
        {' — '}
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
            {source.document}
          </a>
        ) : (
          source.document
        )}
        {source.doi && (
          <span style={{ color: COLOR.textMuted, fontSize: 13 }}>
            {' '}· doi:{' '}
            <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
              {source.doi}
            </a>
          </span>
        )}
      </div>
      <blockquote
        style={{
          margin: '8px 0 0',
          padding: '8px 14px',
          borderLeft: `3px solid ${COLOR.accent}`,
          background: COLOR.surfaceMuted,
          borderRadius: '0 8px 8px 0',
          fontSize: 13,
          color: COLOR.textSecondary,
          fontStyle: 'italic',
        }}
      >
        {source.quote}
      </blockquote>
    </div>
  );
}

function IndexDetail({ def }: Readonly<{ def: IndexDef }>) {
  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
        {def.friendlyName}
        {!isEchoRedundant(def.friendlyName, def.shortName) && ` (${def.shortName})`}
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <EvidenceBadge level={def.evidenceLevel} />
        <span style={{ fontSize: 13, color: COLOR.textMuted }}>{def.panels.join(' · ')}</span>
      </div>

      <div style={{ fontSize: 14, fontFamily: 'monospace', whiteSpace: 'pre-line', background: COLOR.surfaceMuted, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
        {def.formula}
      </div>
      <div style={{ fontSize: 13, color: COLOR.textSecondary, marginBottom: 20 }}>
        Optimal (green) zone: <b>{greenRangeOf(def)}</b>
        {' · '}inputs: {def.inputKeys.join(', ')}
        {def.loinc && (
          <>
            {' · '}LOINC{' '}
            <a href={`https://loinc.org/${def.loinc}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', color: COLOR.accent }}>
              {def.loinc}
            </a>
          </>
        )}
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>What it means</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 20 }}>{def.meaning}</p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Evidence standing</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 20 }}>{def.consensus}</p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>References</h2>
      {def.references.map((ref) => (
        <ReferenceItem key={ref.doi ?? ref.url ?? ref.document} source={ref} />
      ))}
    </div>
  );
}

// Scoped styles for the v2 cascade notation (the original CSS lived in the
// pre-v2 homepage project and did not survive; this is a minimal equivalent).
// The one literal is the notation's own annotation colour: it distinguishes
// two prolactin asides and belongs to the diagram, not to the app palette.
const HP_AXIS_CSS = `
.hp-axis { max-width: 780px; font-size: 14px; color: var(--text); line-height: 1.55; }
.hp-axis .na-sys { margin: 20px 0 8px; font-size: 15px; }
.hp-axis .cascade { overflow-x: auto; background: var(--surface-muted); border-radius: 8px; padding: 12px 14px; font-size: 12.5px; line-height: 1.7; }
.hp-axis .ar { color: var(--accent); font-weight: 700; }
.hp-axis .har { color: var(--text-muted); }
.hp-axis .pr { color: #8e44ad; font-style: italic; }
.hp-axis .cascade-key { margin: 8px 0 0; font-size: 13px; }
.hp-axis .cascade-key dt { font-weight: 600; margin-top: 8px; }
.hp-axis .cascade-key dd { margin: 2px 0 0 0; color: var(--text-secondary); }
.hp-axis .cascade-note { font-size: 13px; color: var(--text-secondary); margin-top: 12px; }
.hp-axis code { background: var(--surface-muted); border-radius: 4px; padding: 0 4px; font-size: 12.5px; }
.hp-axis .ref-note { font-size: 13px; font-style: italic; }
.hp-axis .muted { color: var(--text-muted); }
.hp-axis a { color: var(--accent); }
`;

function HpAxisPage() {
  return (
    <div>
      <style>{HP_AXIS_CSS}</style>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>HP Axis</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 20 }}>
        Hypothalamic–pituitary feedback loops — thyroid (HPT), gonadal (HPG) and adrenal (HPA) — with the
        cascade notation used to read them.
      </div>
      {/* Verbatim v2 prose (static, repo-authored HTML — no user input involved). */}
      <div className="hp-axis" dangerouslySetInnerHTML={{ __html: HP_AXIS_HTML }} />
    </div>
  );
}

const th = { ...TABLE_TH, fontSize: 13 } as const;
const td = { ...TABLE_TD, fontSize: 13 } as const;

const SIBLING_UNITS = new Map(MASS_MOLAR_SIBLINGS.map((p) => [p.molarMass, { mass: p.mass.unit, molar: p.molar.unit }]));

const GLUCOSE_EXAMPLE_MGDL = 95;

// T3 and DHEA-S are tabulated for a computed index's arithmetic rather than for
// a LOINC sibling pair, so no pair supplies the units they are reported in --
// the index engine's own table does.
function unitsOf(id: string) {
  return SIBLING_UNITS.get(id) ?? INDEX_UNIT_PAIRS[id];
}

function prettyUnit(unit: string): string {
  return unit.startsWith('u') ? `µ${unit.slice(1)}` : unit;
}

function sixFigures(value: number): string {
  return String(Number(value.toPrecision(6)));
}

// Stated in whichever direction reads larger than one — "88.4 µmol/L per mg/dL"
// rather than the same fact as "0.011312 mg/dL per µmol/L".
function factorOf(entry: MolarMassEntry): string | undefined {
  const units = unitsOf(entry.id);
  if (!units) return undefined;
  const perMolar = massPerMolarUnit(entry.id, units.mass, units.molar);
  return perMolar >= 1
    ? `${sixFigures(perMolar)} ${prettyUnit(units.mass)} per ${prettyUnit(units.molar)}`
    : `${sixFigures(molarPerMassUnit(entry.id, units.mass, units.molar))} ${prettyUnit(units.molar)} per ${prettyUnit(units.mass)}`;
}

function SourceLinks({ entry }: Readonly<{ entry: MolarMassEntry }>) {
  return (
    <>
      {entry.sources.map((source, i) => (
        <div key={source.url} style={{ marginTop: i === 0 ? 0 : 4 }}>
          <a href={source.url} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
            {source.authority} {source.identifier.replace(/^Standard atomic weight of /, '')}
          </a>
          {source.reportedMolarMassGPerMol != null && (
            <span style={{ color: COLOR.textMuted }}> · reports {source.reportedMolarMassGPerMol}</span>
          )}
        </div>
      ))}
    </>
  );
}

function EntryNote({ entry }: Readonly<{ entry: MolarMassEntry }>) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, color: COLOR.text }}>
        <span style={{ fontWeight: 600 }}>{entry.name}</span>
        <span style={{ color: COLOR.textMuted }}> — {entry.formula}, {entry.molarMassGPerMol} g/mol</span>
      </div>
      <blockquote
        style={{
          margin: '8px 0 0',
          padding: '8px 14px',
          borderLeft: `3px solid ${COLOR.accent}`,
          background: COLOR.surfaceMuted,
          borderRadius: '0 8px 8px 0',
          fontSize: 13,
          color: COLOR.textSecondary,
          lineHeight: 1.55,
        }}
      >
        {entry.note}
      </blockquote>
    </div>
  );
}

function MolarMassesPage() {
  const example = MOLAR_MASS_BY_ID['cholesterol'];
  const exampleUnits = unitsOf('cholesterol');
  const conventional = MOLAR_MASSES.filter((m) => m.basis === 'conventional');
  const noted = MOLAR_MASSES.filter((m) => m.basis !== 'conventional' && m.note);
  const retrieved = sortedUnique(MOLAR_MASSES.flatMap((m) => m.sources.map((s) => s.retrieved)));

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Mass ↔ molar conversion</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 24, maxWidth: 720 }}>
        The molar masses behind every conversion in the app, the sources they were taken from, and the factors
        derived from them.
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Why one analyte has two numbers</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        A lab can report the same substance in two ways: by how much of it weighs into a volume of blood (a mass
        concentration, like mg/dL), or by how many molecules of it are in that volume (a molar concentration, like
        mmol/L). Which one is printed is a habit of the laboratory and the country, not a property of the
        measurement — so one report says glucose {GLUCOSE_EXAMPLE_MGDL} mg/dL and the next says{' '}
        {(GLUCOSE_EXAMPLE_MGDL / massPerMolarUnit('glucose', 'mg/dL', 'mmol/L')).toFixed(2)} mmol/L about the same
        blood.
      </p>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 20, maxWidth: 720 }}>
        What ties the two together is the molecule's weight. One mole of glucose weighs {MOLAR_MASS_BY_ID['glucose']?.molarMassGPerMol} grams,
        and that single fact — scaled by the prefixes of whichever two units are in play — is the conversion
        factor. This app never converts a value a lab printed (a reported number stays exactly as reported); the
        factors exist so two markers measured on different scales can be compared, and so a unit that contradicts
        its test code can be recognised.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Where the numbers come from</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        The app stores molar masses and derives the factors — never the other way round. A factor is an answer to
        one question ("how much mg/dL is one mmol/L?"); the mass is the fact that answers it, and it carries a
        formula and a citation that a bare factor cannot.
      </p>
      <div
        style={{
          fontSize: 13.5,
          fontFamily: 'monospace',
          background: COLOR.surfaceMuted,
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 8,
          overflowX: 'auto',
        }}
      >
        CIAAW standard atomic weights → molecular formula → molar mass (g/mol) → factor for a unit pair
      </div>
      {example && exampleUnits && (
        <div style={{ fontSize: 13, color: COLOR.textSecondary, marginBottom: 20, maxWidth: 720 }}>
          Cholesterol, for example: the weights of carbon, hydrogen and oxygen add up over {example.formula} to{' '}
          {example.molarMassGPerMol} g/mol, and dividing by ten (grams to milligrams, litres to decilitres) gives{' '}
          <b>{factorOf(example)}</b>.
        </div>
      )}

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>The analytes</h2>
      <div style={{ overflowX: 'auto', marginBottom: 8 }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={th}>Analyte</th>
              <th style={th}>Formula</th>
              <th style={th}>g/mol</th>
              <th style={th}>Basis</th>
              <th style={th}>Conversion factor</th>
              <th style={th}>Source</th>
            </tr>
          </thead>
          <tbody>
            {MOLAR_MASSES.map((entry) => (
              <tr key={entry.id}>
                <td style={td}>{entry.name}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{entry.formula}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{entry.molarMassGPerMol}</td>
                <td style={td}>
                  <Pill label={entry.basis} palette={BASIS_BADGE[entry.basis]} />
                </td>
                <td style={td}>{factorOf(entry) ?? '—'}</td>
                <td style={td}>
                  <SourceLinks entry={entry} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 24, maxWidth: 720 }}>
        Each mass is computed from its own formula and the atomic weights below, and checked against the source's
        own reported value — which is why the two can differ in the last digit or two: a chemistry database prints
        four significant figures, and these are carried to six. Retrieved {retrieved.join(', ')}.
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Where the number is a convention</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 14, maxWidth: 720 }}>
        Not every row above is an exact physical constant. Two of them have no single true molar mass at all, and
        clinical practice agrees on a stand-in; the data marks them <i>conventional</i> and requires each to say
        what the convention is.
      </p>
      {conventional.map((entry) => (
        <EntryNote key={entry.id} entry={entry} />
      ))}

      <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Notes on the exact entries</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 14, maxWidth: 720 }}>
        These masses are exact, but what they are applied to is worth stating — a factor can be right and still be
        used for something it does not quite describe.
      </p>
      {noted.map((entry) => (
        <EntryNote key={entry.id} entry={entry} />
      ))}

      <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 10 }}>Atomic weights</h2>
      <p style={{ fontSize: 14, color: COLOR.text, lineHeight: 1.55, marginBottom: 14, maxWidth: 720 }}>
        Every mass above is built from these ten elements — the only ones these analytes are made of. Some elements
        vary in isotopic composition depending on where the sample came from, so the standard is published as an
        interval rather than a single number; where that happens the conventional value from the abridged table is
        used for the arithmetic and the published interval is kept beside it.
      </p>
      <div style={{ overflowX: 'auto', marginBottom: 8 }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={th}>Symbol</th>
              <th style={th}>Element</th>
              <th style={th}>Value used</th>
              <th style={th}>Published as</th>
              <th style={th}>Table</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ATOMIC_WEIGHTS).map(([symbol, weight]) => (
              <tr key={symbol}>
                <td style={{ ...td, fontFamily: 'monospace' }}>{symbol}</td>
                <td style={{ ...td, textTransform: 'capitalize' }}>{weight.element}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{weight.value}</td>
                <td style={{ ...td, fontFamily: 'monospace', color: COLOR.textSecondary }}>{weight.publishedAs}</td>
                <td style={{ ...td, color: COLOR.textMuted }}>{weight.table}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 13, color: COLOR.text, maxWidth: 720 }}>
        <span style={{ fontWeight: 600 }}>{ATOMIC_WEIGHTS_SOURCE.authority}</span>
        {' — '}
        <a href={ATOMIC_WEIGHTS_SOURCE.url} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
          {ATOMIC_WEIGHTS_SOURCE.identifier}
        </a>
        {ATOMIC_WEIGHTS_SOURCE.fullTableUrl && (
          <>
            {' · '}
            <a href={ATOMIC_WEIGHTS_SOURCE.fullTableUrl} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
              full table
            </a>
          </>
        )}
        <span style={{ color: COLOR.textMuted }}> · retrieved {ATOMIC_WEIGHTS_SOURCE.retrieved}</span>
      </div>
    </div>
  );
}

const EM_DASH = '—';

const PRINTED_EXAMPLES = ['ммоль/л', 'мкМЕ/мл', '×10⁹/L', 'тыс/мкл', 'mcg/dL', 'МО/л', 'mmol/l'];

const CATALOG_UNITS = [...Object.values(DEFAULT_UNITS), ...Object.values(ALLOWED_UNITS).flat()];

const UNIT_FAMILIES = unitScaleFamilies(CATALOG_UNITS);

const READABLE_CATALOG_UNITS = new Set(CATALOG_UNITS.map((unit) => toLatinUnit(unit)).filter(Boolean));

const GLUCOSE_SIBLING = MASS_MOLAR_SIBLINGS.find((pair) => pair.mass.loinc === '2345-7') ?? MASS_MOLAR_SIBLINGS[0];

// ALT and insulin stand for the two properties on this page: the
// catalytic-activity code and the arbitrary-unit code people recognise. Every
// verdict in the table below is COMPUTED against them rather than described, so
// the page cannot claim behaviour the code does not have.
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

// Every source here was read on the date below. Two of them (Clinical Chemistry
// and the LOINC Users' Guide) refuse automated fetchers while being free to read
// in a browser, which is why the page links them rather than quoting them.
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

function Mono({ children }: Readonly<{ children: ReactNode }>) {
  return <span style={{ fontFamily: 'monospace' }}>{children}</span>;
}

function Scroller({ children }: Readonly<{ children: ReactNode }>) {
  return <div style={{ overflowX: 'auto', marginBottom: 20 }}>{children}</div>;
}

function UnitsPage({ navigate }: Readonly<{ navigate: (r: Route) => void }>) {
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

const FILTER_INPUT = {
  border: `1.5px solid ${COLOR.accent}`,
  borderRadius: 9999,
  padding: '4px 12px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  lineHeight: '18px',
  color: COLOR.accent,
  backgroundColor: 'transparent',
  width: 260,
  maxWidth: '100%',
  outline: 'none',
} as const;

const wrapTd = { ...td, whiteSpace: 'normal' } as const;

// Under table-layout: auto a cell's max-width is ignored; its width caps the
// column only while min-content fits inside it, which overflow-wrap: anywhere
// guarantees even for an unbroken "25-Hydroxyvitamin D3+25-Hydroxyvitamin D2".
// That same near-zero min-content lets a squeezed table crush the column, hence
// the min-width.
const LONG_NAME_WIDTH = 340;
const longNameTd = {
  ...wrapTd,
  minWidth: 260,
  width: LONG_NAME_WIDTH,
  maxWidth: LONG_NAME_WIDTH,
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
} as const;

// The LOINC name under a code: muted and a size down, so the code stays the line you scan.
const loincNameLine = { color: COLOR.textMuted, fontSize: 12, lineHeight: '16px', marginTop: 2 } as const;

const nameTd = { ...wrapTd, minWidth: 160 } as const;

const sortableTh = { ...th, padding: 0 } as const;

// The whole header cell is the target -- the span carries the padding so a
// 375px tap anywhere in it sorts, and so the cell is reachable by keyboard.
const sortableLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 12px',
  cursor: 'pointer',
  userSelect: 'none',
} as const;

const ARROW = { asc: '▲', desc: '▼' } as const;
const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

function SortableHeader({
  label,
  column,
  sort,
  onSort,
}: Readonly<{
  label: string;
  column: AnalyteSortKey;
  sort: { key: AnalyteSortKey; direction: SortDirection };
  onSort: (key: AnalyteSortKey) => void;
}>) {
  const active = sort.key === column;
  return (
    <th style={sortableTh} aria-sort={active ? ARIA_SORT[sort.direction] : 'none'}>
      <span
        {...pressable(() => onSort(column))}
        aria-label={`Sort by ${label}`}
        style={{ ...sortableLabel, color: active ? COLOR.accent : COLOR.textSecondary }}
      >
        {label}
        <span aria-hidden style={{ fontSize: 9, color: active ? COLOR.accent : COLOR.textDisabled }}>
          {active ? ARROW[sort.direction] : '↕'}
        </span>
      </span>
    </th>
  );
}

function LoincLink({ loinc }: Readonly<{ loinc: string }>) {
  return (
    <a href={`https://loinc.org/${loinc}/`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', color: COLOR.accent }}>
      {loinc}
    </a>
  );
}

/**
 * A real anchor, so the hash is visible on hover and a middle-click opens it,
 * but navigation goes through the app's own router: a bare hash link would
 * change the URL and fire `hashchange`, which the shell does not listen for.
 */
function PanelLinks({ panels, navigate }: Readonly<{ panels: string[]; navigate: (r: Route) => void }>) {
  return (
    <>
      {panels.map((name, i) => (
        <span key={name}>
          {i > 0 && ' · '}
          <a
            href={routeToHash({ view: 'panel', name })}
            onClick={(e) => {
              e.preventDefault();
              navigate({ view: 'panel', name });
            }}
            style={{ color: COLOR.accent }}
          >
            {name}
          </a>
        </span>
      ))}
    </>
  );
}

function PanelsCell({
  membership,
  navigate,
}: Readonly<{ membership: { panels: string[]; via?: string }; navigate: (r: Route) => void }>) {
  if (!membership.panels.length) return <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>;
  if (!membership.via) return <PanelLinks panels={membership.panels} navigate={navigate} />;
  return (
    <span style={{ color: COLOR.textSecondary }} title={`This code is a variant of ${membership.via}; a reading recorded under it is shown in that marker's row.`}>
      <PanelLinks panels={membership.panels} navigate={navigate} />
      <span style={{ color: COLOR.textMuted }}> · via <LoincLink loinc={membership.via} /></span>
    </span>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const labLine = {
  maxWidth: 180,
  fontSize: 11,
  lineHeight: '14px',
  color: COLOR.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** "2026-08-19" at "MS LAB Diagnostics" → "Aug 26" over a muted "MS LAB Diagnostics". */
function LastTestedCell({ entry }: Readonly<{ entry?: ResultEntry }>) {
  if (!entry) return <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>;
  const [year, month] = entry.date.split('-');
  const lab = namedLab(entry.place);
  return (
    <>
      {`${MONTHS[Number(month) - 1] ?? month} ${year.slice(2)}`}
      {lab && (
        <div style={labLine} title={lab}>
          {lab}
        </div>
      )}
    </>
  );
}

function UnitsCell({ analyte }: Readonly<{ analyte: Analysis }>) {
  if (!analyte.unit) return <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>;
  return (
    <>
      <span style={{ fontFamily: 'monospace' }}>{analyte.unit}</span>
      {analyte.allowedUnits?.length && (
        <span style={{ color: COLOR.textMuted, fontFamily: 'monospace' }}> · {analyte.allowedUnits.join(' · ')}</span>
      )}
    </>
  );
}

function LoincDatabasePage({
  allResults,
  navigate,
}: Readonly<{ allResults?: readonly ResultEntry[]; navigate: (r: Route) => void }>) {
  const { panels, monitoringPanels } = useData();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: AnalyteSortKey; direction: SortDirection }>({ key: 'friendlyName', direction: 'asc' });

  // Exact code, no alias folding: the column answers "which code did my lab print".
  const lastTested = useMemo(() => latestEntryByLoinc(allResults ?? []), [allResults]);

  const rows = useMemo(() => {
    const panelsByLoinc = buildPanelsByLoinc(buildConditions(panels, ANALYTE_BY_LOINC, monitoringPanels));
    return ANALYTES.map((analyte) => {
      // The property bracket and specimen clause have columns of their own, so the
      // LOINC name under each code shows neither.
      const trimmedName = trimmedLongName(analyte.longCommonName);
      const shortName = SHORT_NAMES[analyte.loinc]?.shortName;
      const latest = lastTested[analyte.loinc];
      return {
        analyte,
        membership: panelMembershipOf(panelsByLoinc, analyte.loinc),
        trimmedName,
        shortName,
        latest,
        sortValues: {
          loinc: analyte.loinc,
          friendlyName: analyte.friendlyName,
          specimen: SPECIMENS[analyte.loinc],
          unit: analyte.unit,
          lastTested: latest?.date,
        } satisfies AnalyteSortValues,
        observation: {
          shortName: shortName ?? analyte.friendlyName,
          friendlyName: analyte.friendlyName,
          longCommonName: analyte.longCommonName,
          loinc: analyte.loinc,
          also: ALSO_REFS[analyte.loinc],
        } satisfies Observation,
      };
    });
  }, [panels, monitoringPanels, lastTested]);

  // The catalog's translations stand in for the printed names All Observations
  // passes: here there are no uploaded reports, but a Cyrillic name should still
  // find its row.
  const primaryCount = useMemo(() => ANALYTES.filter((a) => !a.aliasOf).length, []);

  const matched = rows.filter((row) => observationMatchesQuery(row.observation, query, Object.values(row.analyte.lang)));
  const shown = sortAnalytes(matched, (row) => row.sortValues, sort.key, sort.direction);

  const toggle = (key: AnalyteSortKey) =>
    setSort((current) =>
      current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
    );

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>LOINC database</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 20, maxWidth: 720 }}>
        Every analyte the app knows, as the catalog defines it. The specimen is read out of each LOINC name; where
        a name does not state one, nothing is shown rather than a guess. The LOINC name under each code drops that
        clause and the property bracket, both having columns of their own — hover it for the official string.
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLOR.textMuted, marginBottom: 6 }}>Find a marker</div>
        <input
          type="search"
          aria-label="Filter the LOINC database by name or code"
          placeholder="HGB, Hemoglobin, 718-7…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          style={FILTER_INPUT}
        />
      </div>
      <div style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 14 }}>
        {/* A row is a code, not an analyte: a code fixes the property and specimen too, so
            cholesterol occupies two. The second figure counts the primaries the aliases fold into. */}
        {shown.length === rows.length
          ? `${rows.length} codes · ${primaryCount} analytes`
          : `${shown.length} of ${rows.length} codes · ${primaryCount} analytes`}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <SortableHeader label="LOINC" column="loinc" sort={sort} onSort={toggle} />
              <SortableHeader label="Name" column="friendlyName" sort={sort} onSort={toggle} />
              <SortableHeader label="Specimen" column="specimen" sort={sort} onSort={toggle} />
              <SortableHeader label="Units" column="unit" sort={sort} onSort={toggle} />
              <SortableHeader label="Last tested" column="lastTested" sort={sort} onSort={toggle} />
              <th style={th} title="A code can belong to several panels, or to none, so there is no one order to put them in.">
                Panels
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ analyte, membership, trimmedName, shortName, latest }) => (
              <tr key={analyte.loinc}>
                <td style={longNameTd}>
                  <LoincLink loinc={analyte.loinc} />
                  <div style={loincNameLine} title={analyte.longCommonName}>
                    {trimmedName}
                  </div>
                </td>
                <td style={nameTd}>
                  {analyte.friendlyName}
                  {shortName && shortName !== analyte.friendlyName && (
                    <div style={{ color: COLOR.textMuted }}>{shortName}</div>
                  )}
                </td>
                <td style={td}>
                  {SPECIMENS[analyte.loinc] ?? <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>}
                </td>
                <td style={td}>
                  <UnitsCell analyte={analyte} />
                </td>
                <td style={td}>
                  <LastTestedCell entry={latest} />
                </td>
                <td style={{ ...wrapTd, minWidth: 180 }}>
                  <PanelsCell membership={membership} navigate={navigate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReferenceBookPage({
  indexKey,
  navigate,
  allResults,
}: Readonly<{ indexKey?: string; navigate: (r: Route) => void; allResults?: readonly ResultEntry[] }>) {
  if (indexKey === 'hp-axis') return <HpAxisPage />;
  if (indexKey === 'molar-masses') return <MolarMassesPage />;
  if (indexKey === 'units') return <UnitsPage navigate={navigate} />;
  if (indexKey === 'loinc-database') return <LoincDatabasePage allResults={allResults} navigate={navigate} />;
  const def = indexKey ? INDEX_DEFS.find((d) => d.key === indexKey) : undefined;
  if (def) return <IndexDetail def={def} />;

  // Index list, grouped by the first monitoring panel each index belongs to.
  const groups = new Map<string, IndexDef[]>();
  for (const d of INDEX_DEFS) {
    const panel = d.panels[0] ?? 'Other';
    (groups.get(panel) ?? groups.set(panel, []).get(panel)!).push(d);
  }

  return (
    <div>
      <PageHeader
        overline="Clinical Knowledge Base"
        titlePrimary="Reference"
        titleAccent="Book"
        description={[
          'Evidence-graded clinical guidance, reference ranges, and index calculation formulas.',
          'Understand your results through published consensus standards and clinical trials.',
        ]}
        pillars={[
          { icon: BookOpen, line1: 'Curated clinical', line2: 'guidelines' },
          { icon: Calculator, line1: 'Evidence-based', line2: 'index formulas' },
          { icon: ShieldCheck, line1: 'Graded reference', line2: 'ranges' },
        ]}
      />
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Organism-wide aspects</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'hp-axis' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>HP Axis</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>Hypothalamic–pituitary feedback loops (HPT · HPG · HPA)</span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Formulas and math</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'molar-masses' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>Mass ↔ molar conversion</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>Molar masses, their sources, and the factors derived from them</span>
      </div>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'units' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>Units and how they are read</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>
          UCUM, the three normalization stages, and what is never converted
        </span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Analytes</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'loinc-database' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>LOINC database</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>
          Every analyte the app knows — code, name, specimen, units and panels
        </span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Indices and derived measurements</h2>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 24 }}>
        Physiology, evidence standing and cited sources for every value the app calculates — derived measurements, a real
        analyte's concentration arrived at arithmetically, and indices proper, ratios and scores this app computes itself
        rather than taking from the lab (even one a lab may also print, like TC/HDL).
      </div>
      {Array.from(groups.entries()).map(([panel, defs]) => (
        <div key={panel} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', color: COLOR.textMuted, marginBottom: 10 }}>
            {panel}
          </div>
          {defs.map((d) => (
            <div
              key={d.key}
              {...pressable(() => navigate({ view: 'reference', key: d.key }))}
              style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>{d.shortName}</span>
              <span style={{ fontSize: 14, color: COLOR.textSecondary }}>{d.friendlyName}</span>
              <EvidenceBadge level={d.evidenceLevel} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
