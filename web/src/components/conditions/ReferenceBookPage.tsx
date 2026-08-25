import { INDEX_DEFS, type IndexDef, type IndexReference } from '../../data/computedIndices';
import { greenRangeOf } from './ui';
import { isEchoRedundant } from './markers';
import type { Route } from './routing';

// Reference Book — one page per computed index, carrying the full clinical
// prose (meaning + evidence standing) and its cited sources with verbatim
// quotes, ported from project-bloodtests-v2's index catalog (ADR-0007).

const EVIDENCE_BADGE: Record<string, { background: string; color: string }> = {
  consensus: { background: '#e6f4ea', color: '#1e7e34' },
  heuristic: { background: '#fff4e0', color: '#a05a00' },
};

function EvidenceBadge({ level }: { level: string }) {
  const style = EVIDENCE_BADGE[level] ?? { background: '#f5f5f5', color: '#666' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        ...style,
      }}
    >
      {level}
    </span>
  );
}

function ReferenceItem({ source }: { source: IndexReference }) {
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

function IndexDetail({ def, navigate }: { def: IndexDef; navigate: (r: Route) => void }) {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', marginBottom: 20 }}>
        <span onClick={() => navigate({ view: 'reference' })} style={{ color: '#1971c2', cursor: 'pointer' }}>
          Reference Book
        </span>
        <span>›</span>
        <span>{def.nameCompact}</span>
      </div>
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
      {def.references.map((ref, i) => (
        <ReferenceItem key={i} source={ref} />
      ))}
    </div>
  );
}

export function ReferenceBookPage({ indexKey, navigate }: { indexKey?: string; navigate: (r: Route) => void }) {
  const def = indexKey ? INDEX_DEFS.find((d) => d.key === indexKey) : undefined;
  if (def) return <IndexDetail def={def} navigate={navigate} />;

  // Index list, grouped by the first monitoring panel each index belongs to.
  const groups = new Map<string, IndexDef[]>();
  for (const d of INDEX_DEFS) {
    const panel = d.panels[0] ?? 'Other';
    (groups.get(panel) ?? groups.set(panel, []).get(panel)!).push(d);
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Reference Book</h1>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>
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
              onClick={() => navigate({ view: 'reference', key: d.key })}
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
