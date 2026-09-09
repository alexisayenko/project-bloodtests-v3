import { useMemo, useState } from 'react';
import { INDEX_UNIT_PAIRS, type IndexDef, type IndexReference } from '../../data/computedIndices';
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
import { greenRangeOf, pressable } from './ui';
import {
  buildConditions,
  buildPanelsByLoinc,
  isEchoRedundant,
  observationMatchesQuery,
  panelMembershipOf,
  type Observation,
} from './markers';
import { sortAnalytes, type AnalyteSortKey, type AnalyteSortValues, type SortDirection } from './analyteSort';
import type { Route } from './routing';
import { COLOR } from '../../styles/tokens';
import { useData } from '../../data/DataContext';
import { ALSO_REFS, ANALYTES, ANALYTE_BY_LOINC, SHORT_LABELS, SPECIMENS } from '../../data/analyteCatalog';
import type { Analysis } from '../../types';

// Reference Book — one page per computed index, carrying the full clinical
// prose (meaning + evidence standing) and its cited sources with verbatim
// quotes, ported from project-bloodtests-v2's index catalog (ADR-0007).

const EVIDENCE_BADGE: Record<string, { background: string; color: string }> = {
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
        {def.name}
        {!isEchoRedundant(def.name, def.nameCompact) && ` (${def.nameCompact})`}
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
        {' · '}inputs: {def.needs.join(', ')}
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

const th = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: `1.5px solid ${COLOR.accent}`,
  whiteSpace: 'nowrap',
  fontSize: 13,
} as const;
const td = { padding: '8px 12px', borderBottom: `1px solid ${COLOR.borderSubtle}`, whiteSpace: 'nowrap', fontSize: 13 } as const;

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
  const retrieved = Array.from(new Set(MOLAR_MASSES.flatMap((m) => m.sources.map((s) => s.retrieved)))).sort();

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
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
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
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
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
    <th style={sortableTh} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
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

function PanelsCell({ membership }: Readonly<{ membership: { panels: string[]; via?: string } }>) {
  if (!membership.panels.length) return <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>;
  if (!membership.via) return <>{membership.panels.join(' · ')}</>;
  return (
    <span style={{ color: COLOR.textSecondary }} title={`This code is a variant of ${membership.via}; a reading recorded under it is shown in that marker's row.`}>
      {membership.panels.join(' · ')}
      <span style={{ color: COLOR.textMuted }}> · via <LoincLink loinc={membership.via} /></span>
    </span>
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

function LoincDatabasePage() {
  const { panels, monitoringPanels } = useData();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: AnalyteSortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });

  const rows = useMemo(() => {
    const panelsByLoinc = buildPanelsByLoinc(buildConditions(panels, ANALYTE_BY_LOINC, monitoringPanels));
    return ANALYTES.map((analyte) => ({
      analyte,
      membership: panelMembershipOf(panelsByLoinc, analyte.loinc),
      sortValues: {
        loinc: analyte.loinc,
        name: analyte.longCommonName,
        short: SHORT_LABELS[analyte.loinc]?.short,
        specimen: SPECIMENS[analyte.loinc],
        unit: analyte.unit,
      } satisfies AnalyteSortValues,
      observation: {
        short: SHORT_LABELS[analyte.loinc]?.short ?? analyte.displayName,
        full: analyte.displayName,
        longCommonName: analyte.longCommonName,
        loinc: analyte.loinc,
        also: ALSO_REFS[analyte.loinc],
      } satisfies Observation,
    }));
  }, [panels, monitoringPanels]);

  // The catalog's translations stand in for the printed names All Observations
  // passes: here there are no uploaded reports, but a Cyrillic name should still
  // find its row.
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
        Every analyte the app knows, as the catalog defines it. The specimen is read out of each official long
        name; where a name does not state one, nothing is shown rather than a guess.
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
        {shown.length === rows.length ? `${rows.length} analytes` : `${shown.length} of ${rows.length} analytes`}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <SortableHeader label="LOINC" column="loinc" sort={sort} onSort={toggle} />
              <SortableHeader label="Long name" column="name" sort={sort} onSort={toggle} />
              <SortableHeader label="Short" column="short" sort={sort} onSort={toggle} />
              <SortableHeader label="Specimen" column="specimen" sort={sort} onSort={toggle} />
              <SortableHeader label="Units" column="unit" sort={sort} onSort={toggle} />
              <th style={th} title="A code can belong to several panels, or to none, so there is no one order to put them in.">
                Panels
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ analyte, membership }) => (
              <tr key={analyte.loinc}>
                <td style={td}>
                  <LoincLink loinc={analyte.loinc} />
                </td>
                <td style={{ ...wrapTd, minWidth: 260 }}>
                  {analyte.longCommonName}
                  <div style={{ color: COLOR.textMuted }}>{analyte.displayName}</div>
                </td>
                <td style={td}>
                  {SHORT_LABELS[analyte.loinc]?.short ?? <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>}
                </td>
                <td style={td}>
                  {SPECIMENS[analyte.loinc] ?? <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>}
                </td>
                <td style={td}>
                  <UnitsCell analyte={analyte} />
                </td>
                <td style={{ ...wrapTd, minWidth: 180 }}>
                  <PanelsCell membership={membership} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReferenceBookPage({ indexKey, navigate }: Readonly<{ indexKey?: string; navigate: (r: Route) => void }>) {
  if (indexKey === 'hp-axis') return <HpAxisPage />;
  if (indexKey === 'molar-masses') return <MolarMassesPage />;
  if (indexKey === 'loinc-database') return <LoincDatabasePage />;
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
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 28 }}>Reference Book</h1>
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
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>Mass ↔ molar conversion</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>Molar masses, their sources, and the factors derived from them</span>
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
        analyte's concentration arrived at arithmetically, and indices proper, ratios and scores no lab prints.
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
              <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>{d.nameCompact}</span>
              <span style={{ fontSize: 14, color: COLOR.textSecondary }}>{d.name}</span>
              <EvidenceBadge level={d.evidenceLevel} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
