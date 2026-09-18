import { INDEX_UNIT_PAIRS } from '../../data/computedIndices';
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
import { COLOR } from '../../styles/tokens';
import { sortedUnique } from '../conditions/analyteSort';
import { TABLE } from '../primitives/styles';
import { td, th } from './cells';
import { Pill } from './parts';

const BASIS_BADGE: Record<string, { background: string; color: string }> = {
  compound: { background: COLOR.statusOkBg, color: COLOR.statusOkText },
  element: { background: COLOR.accentSoft, color: COLOR.accent },
  conventional: { background: COLOR.statusWarnBg, color: COLOR.statusWarnText },
};

const SIBLING_UNITS = new Map(MASS_MOLAR_SIBLINGS.map((p) => [p.molarMass, { mass: p.mass.unit, molar: p.molar.unit }]));

const GLUCOSE_EXAMPLE_MGDL = 95;

// T3 and DHEA-S have no sibling pair; the index engine's own table supplies their units.
function unitsOf(id: string) {
  return SIBLING_UNITS.get(id) ?? INDEX_UNIT_PAIRS[id];
}

function prettyUnit(unit: string): string {
  return unit.startsWith('u') ? `µ${unit.slice(1)}` : unit;
}

function sixFigures(value: number): string {
  return String(Number(value.toPrecision(6)));
}

// Stated in whichever direction reads larger than one.
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

export function MolarMassesPage() {
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
