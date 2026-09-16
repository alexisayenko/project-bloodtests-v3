import type { CSSProperties } from 'react';
import { COLOR } from '../../styles/tokens';
import { TABLE, TABLE_TD, TABLE_TH } from '../primitives/styles';
import {
  LIPOPROTEIN_PARTICLES,
  LIPOPROTEIN_SOURCES,
  citedSourceIds,
  shareRange,
  type Interval,
  type LipoproteinSource,
  type ShareRange,
} from '../../data/lipoproteinParticles';

const CITED = citedSourceIds();
const SOURCE_BY_ID = Object.fromEntries(LIPOPROTEIN_SOURCES.map((s) => [s.id, s]));
const sourceAnchor = (id: string) => `lipid-source-${id}`;
const sourceNumber = (id: string) => CITED.indexOf(id) + 1;

function Cite({ ids }: Readonly<{ ids: readonly string[] }>) {
  return (
    <sup style={{ fontSize: '0.75em', fontWeight: 600, marginLeft: 2 }}>
      {ids.map((id) => (
        <a
          key={id}
          href={`#${sourceAnchor(id)}`}
          onClick={(e) => {
            // The app routes on the URL hash, so an in-page jump must not rewrite it.
            e.preventDefault();
            document.getElementById(sourceAnchor(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          style={{ color: COLOR.accent, textDecoration: 'none' }}
        >
          [{sourceNumber(id)}]
        </a>
      ))}
    </sup>
  );
}

function IntervalCell({ interval }: Readonly<{ interval: Interval }>) {
  const { min, max, exclusiveMax, approximate } = interval;
  let text: string;
  if (min === undefined) text = `${exclusiveMax ? '<' : '≤'} ${max}`;
  else if (max === undefined || min === max) text = `${approximate ? '~' : ''}${min}`;
  else text = `${min}–${max}`;
  return (
    <>
      {text}
      <Cite ids={[interval.source]} />
    </>
  );
}

function ShareCell({ range }: Readonly<{ range?: ShareRange }>) {
  if (!range) return <span style={{ color: COLOR.textMuted }}>not sourced</span>;
  return (
    <>
      {range.min === range.max ? range.min : `${range.min}–${range.max}`}
      <Cite ids={range.sources} />
    </>
  );
}

function SourceItem({ source }: Readonly<{ source: LipoproteinSource }>) {
  const quoteStyle: CSSProperties = {
    margin: '8px 0 0',
    padding: '8px 14px',
    borderLeft: `3px solid ${COLOR.accent}`,
    background: COLOR.surfaceMuted,
    borderRadius: '0 8px 8px 0',
    fontSize: 13,
    color: COLOR.textSecondary,
  };
  return (
    <div id={sourceAnchor(source.id)} style={{ marginBottom: 18, scrollMarginTop: 80, maxWidth: 820 }}>
      <div style={{ fontSize: 14, color: COLOR.text }}>
        <span style={{ fontWeight: 600, color: COLOR.accent }}>[{sourceNumber(source.id)}]</span>{' '}
        <span style={{ fontWeight: 600 }}>{source.authors}</span>
        {' — '}
        <a href={source.url} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
          {source.title}
        </a>
        <span style={{ color: COLOR.textMuted, fontSize: 13 }}>
          {' '}
          · {source.publication} · retrieved {source.retrieved}
        </span>
      </div>
      {source.quote && <blockquote style={{ ...quoteStyle, fontStyle: 'italic' }}>“{source.quote}”</blockquote>}
      {source.table && <div style={quoteStyle}>Read from {source.table}.</div>}
    </div>
  );
}

const H2: CSSProperties = { fontSize: 19, fontWeight: 600, margin: '28px 0 6px' };
const NOTE: CSSProperties = { fontSize: 14, color: COLOR.textMuted, maxWidth: 760, lineHeight: 1.55 };

/** The sourced size and composition table under the diagram, with its numbered sources. */
export function CompositionSection() {
  const notes = LIPOPROTEIN_PARTICLES.filter((p) => p.note);
  return (
    <>
      <h2 style={H2}>Size and composition</h2>
      <div style={{ ...NOTE, marginBottom: 12 }}>
        Percent of total particle mass, as each source printed it; where sources disagree the range spans them.
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table style={TABLE}>
          <thead>
            <tr>
              {['Particle', 'Holder apoprotein', 'Diameter (nm)', 'Density (g/mL)', 'TRIG %', 'Chol %'].map((h) => (
                <th key={h} style={TABLE_TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIPOPROTEIN_PARTICLES.map((p) => (
              <tr key={p.id}>
                <td style={{ ...TABLE_TD, fontWeight: 600 }}>{p.name}</td>
                <td style={TABLE_TD}>
                  {p.structuralApolipoproteins.join(' + ')}
                  <Cite ids={[p.majorApoproteins.source]} />
                </td>
                <td style={TABLE_TD}>
                  <IntervalCell interval={p.diameterNm} />
                </td>
                <td style={TABLE_TD}>
                  <IntervalCell interval={p.densityGPerMl} />
                </td>
                <td style={TABLE_TD}>
                  <ShareCell range={shareRange(p, 'triglyceride')} />
                </td>
                <td style={TABLE_TD}>
                  <ShareCell range={shareRange(p, 'cholesterol')} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul style={{ fontSize: 13, color: COLOR.textSecondary, margin: '0 0 28px', paddingLeft: 18, maxWidth: 820, lineHeight: 1.6 }}>
        {notes.map((p) => (
          <li key={p.id}>
            <span style={{ fontWeight: 600 }}>{p.name}:</span> {p.note}
          </li>
        ))}
      </ul>
      <h2 style={{ ...H2, marginBottom: 10 }}>Sources</h2>
      {CITED.map((id) => SOURCE_BY_ID[id] && <SourceItem key={id} source={SOURCE_BY_ID[id]} />)}
    </>
  );
}
