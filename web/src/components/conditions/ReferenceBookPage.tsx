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
import { isEchoRedundant } from './markers';
import type { Route } from './routing';

// Reference Book — one page per computed index, carrying the full clinical
// prose (meaning + evidence standing) and its cited sources with verbatim
// quotes, ported from project-bloodtests-v2's index catalog (ADR-0007).

const EVIDENCE_BADGE: Record<string, { background: string; color: string }> = {
  consensus: { background: '#e6f4ea', color: '#1e7e34' },
  heuristic: { background: '#fff4e0', color: '#a05a00' },
};

const BASIS_BADGE: Record<string, { background: string; color: string }> = {
  compound: { background: '#e6f4ea', color: '#1e7e34' },
  element: { background: '#eaf3fb', color: '#1971c2' },
  conventional: { background: '#fff4e0', color: '#a05a00' },
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
        ...(palette ?? { background: '#f5f5f5', color: '#666' }),
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
      <div style={{ fontSize: 14, color: '#333' }}>
        <span style={{ fontWeight: 600 }}>{source.organization}</span>
        {source.year && <span style={{ color: '#888' }}> ({source.year})</span>}
        {' — '}
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" style={{ color: '#1971c2' }}>
            {source.document}
          </a>
        ) : (
          source.document
        )}
        {source.doi && (
          <span style={{ color: '#888', fontSize: 13 }}>
            {' '}· doi:{' '}
            <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer" style={{ color: '#1971c2' }}>
              {source.doi}
            </a>
          </span>
        )}
      </div>
      <blockquote
        style={{
          margin: '8px 0 0',
          padding: '8px 14px',
          borderLeft: '3px solid #1971c2',
          background: '#f6f9fc',
          borderRadius: '0 8px 8px 0',
          fontSize: 13,
          color: '#444',
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
        <span style={{ fontSize: 13, color: '#888' }}>{def.panels.join(' · ')}</span>
      </div>

      <div style={{ fontSize: 14, fontFamily: 'monospace', whiteSpace: 'pre-line', background: '#f5f5f5', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
        {def.formula}
      </div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
        Optimal (green) zone: <b>{greenRangeOf(def)}</b>
        {' · '}inputs: {def.needs.join(', ')}
        {def.loinc && (
          <>
            {' · '}LOINC{' '}
            <a href={`https://loinc.org/${def.loinc}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', color: '#1971c2' }}>
              {def.loinc}
            </a>
          </>
        )}
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>What it means</h2>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.55, marginBottom: 20 }}>{def.meaning}</p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Evidence standing</h2>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.55, marginBottom: 20 }}>{def.consensus}</p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>References</h2>
      {def.references.map((ref) => (
        <ReferenceItem key={ref.doi ?? ref.url ?? ref.document} source={ref} />
      ))}
    </div>
  );
}

// Scoped styles for the v2 cascade notation (the original CSS lived in the
// pre-v2 homepage project and did not survive; this is a minimal equivalent).
const HP_AXIS_CSS = `
.hp-axis { max-width: 780px; font-size: 14px; color: #333; line-height: 1.55; }
.hp-axis .na-sys { margin: 20px 0 8px; font-size: 15px; }
.hp-axis .cascade { overflow-x: auto; background: #f5f5f5; border-radius: 8px; padding: 12px 14px; font-size: 12.5px; line-height: 1.7; }
.hp-axis .ar { color: #1971c2; font-weight: 700; }
.hp-axis .har { color: #999; }
.hp-axis .pr { color: #8e44ad; font-style: italic; }
.hp-axis .cascade-key { margin: 8px 0 0; font-size: 13px; }
.hp-axis .cascade-key dt { font-weight: 600; margin-top: 8px; }
.hp-axis .cascade-key dd { margin: 2px 0 0 0; color: #555; }
.hp-axis .cascade-note { font-size: 13px; color: #555; margin-top: 12px; }
.hp-axis code { background: #f0f3f6; border-radius: 4px; padding: 0 4px; font-size: 12.5px; }
.hp-axis .ref-note { font-size: 13px; font-style: italic; }
.hp-axis .muted { color: #888; }
.hp-axis a { color: #1971c2; }
`;

function HpAxisPage() {
  return (
    <div>
      <style>{HP_AXIS_CSS}</style>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>HP Axis</h1>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
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
  borderBottom: '1.5px solid #1971c2',
  whiteSpace: 'nowrap',
  fontSize: 13,
} as const;
const td = { padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', fontSize: 13 } as const;

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
          <a href={source.url} target="_blank" rel="noreferrer" style={{ color: '#1971c2' }}>
            {source.authority} {source.identifier.replace(/^Standard atomic weight of /, '')}
          </a>
          {source.reportedMolarMassGPerMol != null && (
            <span style={{ color: '#888' }}> · reports {source.reportedMolarMassGPerMol}</span>
          )}
        </div>
      ))}
    </>
  );
}

function EntryNote({ entry }: Readonly<{ entry: MolarMassEntry }>) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, color: '#333' }}>
        <span style={{ fontWeight: 600 }}>{entry.name}</span>
        <span style={{ color: '#888' }}> — {entry.formula}, {entry.molarMassGPerMol} g/mol</span>
      </div>
      <blockquote
        style={{
          margin: '8px 0 0',
          padding: '8px 14px',
          borderLeft: '3px solid #1971c2',
          background: '#f6f9fc',
          borderRadius: '0 8px 8px 0',
          fontSize: 13,
          color: '#444',
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
      <div style={{ color: '#888', fontSize: 14, marginBottom: 24, maxWidth: 720 }}>
        The molar masses behind every conversion in the app, the sources they were taken from, and the factors
        derived from them.
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Why one analyte has two numbers</h2>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        A lab can report the same substance in two ways: by how much of it weighs into a volume of blood (a mass
        concentration, like mg/dL), or by how many molecules of it are in that volume (a molar concentration, like
        mmol/L). Which one is printed is a habit of the laboratory and the country, not a property of the
        measurement — so one report says glucose {GLUCOSE_EXAMPLE_MGDL} mg/dL and the next says{' '}
        {(GLUCOSE_EXAMPLE_MGDL / massPerMolarUnit('glucose', 'mg/dL', 'mmol/L')).toFixed(2)} mmol/L about the same
        blood.
      </p>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.55, marginBottom: 20, maxWidth: 720 }}>
        What ties the two together is the molecule's weight. One mole of glucose weighs {MOLAR_MASS_BY_ID['glucose']?.molarMassGPerMol} grams,
        and that single fact — scaled by the prefixes of whichever two units are in play — is the conversion
        factor. This app never converts a value a lab printed (a reported number stays exactly as reported); the
        factors exist so two markers measured on different scales can be compared, and so a unit that contradicts
        its test code can be recognised.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Where the numbers come from</h2>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.55, marginBottom: 12, maxWidth: 720 }}>
        The app stores molar masses and derives the factors — never the other way round. A factor is an answer to
        one question ("how much mg/dL is one mmol/L?"); the mass is the fact that answers it, and it carries a
        formula and a citation that a bare factor cannot.
      </p>
      <div
        style={{
          fontSize: 13.5,
          fontFamily: 'monospace',
          background: '#f5f5f5',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 8,
          overflowX: 'auto',
        }}
      >
        CIAAW standard atomic weights → molecular formula → molar mass (g/mol) → factor for a unit pair
      </div>
      {example && exampleUnits && (
        <div style={{ fontSize: 13, color: '#555', marginBottom: 20, maxWidth: 720 }}>
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
      <div style={{ fontSize: 13, color: '#888', marginBottom: 24, maxWidth: 720 }}>
        Each mass is computed from its own formula and the atomic weights below, and checked against the source's
        own reported value — which is why the two can differ in the last digit or two: a chemistry database prints
        four significant figures, and these are carried to six. Retrieved {retrieved.join(', ')}.
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Where the number is a convention</h2>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.55, marginBottom: 14, maxWidth: 720 }}>
        Not every row above is an exact physical constant. Two of them have no single true molar mass at all, and
        clinical practice agrees on a stand-in; the data marks them <i>conventional</i> and requires each to say
        what the convention is.
      </p>
      {conventional.map((entry) => (
        <EntryNote key={entry.id} entry={entry} />
      ))}

      <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Notes on the exact entries</h2>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.55, marginBottom: 14, maxWidth: 720 }}>
        These masses are exact, but what they are applied to is worth stating — a factor can be right and still be
        used for something it does not quite describe.
      </p>
      {noted.map((entry) => (
        <EntryNote key={entry.id} entry={entry} />
      ))}

      <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 10 }}>Atomic weights</h2>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.55, marginBottom: 14, maxWidth: 720 }}>
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
                <td style={{ ...td, fontFamily: 'monospace', color: '#555' }}>{weight.publishedAs}</td>
                <td style={{ ...td, color: '#888' }}>{weight.table}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 13, color: '#333', maxWidth: 720 }}>
        <span style={{ fontWeight: 600 }}>{ATOMIC_WEIGHTS_SOURCE.authority}</span>
        {' — '}
        <a href={ATOMIC_WEIGHTS_SOURCE.url} target="_blank" rel="noreferrer" style={{ color: '#1971c2' }}>
          {ATOMIC_WEIGHTS_SOURCE.identifier}
        </a>
        {ATOMIC_WEIGHTS_SOURCE.fullTableUrl && (
          <>
            {' · '}
            <a href={ATOMIC_WEIGHTS_SOURCE.fullTableUrl} target="_blank" rel="noreferrer" style={{ color: '#1971c2' }}>
              full table
            </a>
          </>
        )}
        <span style={{ color: '#888' }}> · retrieved {ATOMIC_WEIGHTS_SOURCE.retrieved}</span>
      </div>
    </div>
  );
}

export function ReferenceBookPage({ indexKey, navigate }: Readonly<{ indexKey?: string; navigate: (r: Route) => void }>) {
  if (indexKey === 'hp-axis') return <HpAxisPage />;
  if (indexKey === 'molar-masses') return <MolarMassesPage />;
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
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Physiology</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'hp-axis' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1971c2' }}>HP Axis</span>
        <span style={{ fontSize: 14, color: '#555' }}>Hypothalamic–pituitary feedback loops (HPT · HPG · HPA)</span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Units</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'molar-masses' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1971c2' }}>Mass ↔ molar conversion</span>
        <span style={{ fontSize: 14, color: '#555' }}>Molar masses, their sources, and the factors derived from them</span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Indices Descriptions</h2>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
        Physiology, evidence standing and cited sources for every computed index.
      </div>
      {Array.from(groups.entries()).map(([panel, defs]) => (
        <div key={panel} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', color: '#888', marginBottom: 10 }}>
            {panel}
          </div>
          {defs.map((d) => (
            <div
              key={d.key}
              {...pressable(() => navigate({ view: 'reference', key: d.key }))}
              style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1971c2' }}>{d.nameCompact}</span>
              <span style={{ fontSize: 14, color: '#555' }}>{d.name}</span>
              <EvidenceBadge level={d.evidenceLevel} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
