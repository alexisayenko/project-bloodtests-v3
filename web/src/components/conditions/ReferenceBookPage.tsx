import { INDEX_DEFS, type IndexDef, type IndexReference } from '../../data/computedIndices';
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

function EvidenceBadge({ level }: Readonly<{ level: string }>) {
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

function IndexDetail({ def, navigate }: Readonly<{ def: IndexDef; navigate: (r: Route) => void }>) {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', marginBottom: 20 }}>
        <span {...pressable(() => navigate({ view: 'reference' }))} style={{ color: '#1971c2', cursor: 'pointer' }}>
          Reference Book
        </span>
        <span>›</span>
        <span {...pressable(() => navigate({ view: 'reference' }))} style={{ color: '#1971c2', cursor: 'pointer' }}>
          Indices Descriptions
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

function HpAxisPage({ navigate }: Readonly<{ navigate: (r: Route) => void }>) {
  return (
    <div>
      <style>{HP_AXIS_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', marginBottom: 20 }}>
        <span {...pressable(() => navigate({ view: 'reference' }))} style={{ color: '#1971c2', cursor: 'pointer' }}>
          Reference Book
        </span>
        <span>›</span>
        <span>HP Axis</span>
      </div>
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

export function ReferenceBookPage({ indexKey, navigate }: Readonly<{ indexKey?: string; navigate: (r: Route) => void }>) {
  if (indexKey === 'hp-axis') return <HpAxisPage navigate={navigate} />;
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
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 28 }}>Reference Book</h1>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Physiology</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'hp-axis' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1971c2' }}>HP Axis</span>
        <span style={{ fontSize: 14, color: '#555' }}>Hypothalamic–pituitary feedback loops (HPT · HPG · HPA)</span>
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
