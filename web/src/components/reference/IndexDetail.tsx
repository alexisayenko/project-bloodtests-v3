import type { IndexDef, IndexReference } from '../../data/computedIndices';
import { COLOR } from '../../styles/tokens';
import { isEchoRedundant } from '../conditions/markers';
import { greenRangeOf } from '../conditions/resultCells';
import { EvidenceBadge } from './parts';

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
        {source.retrieved && (
          <span style={{ color: COLOR.textMuted, fontSize: 13 }}> · retrieved {source.retrieved}</span>
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

export function IndexDetail({ def }: Readonly<{ def: IndexDef }>) {
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
