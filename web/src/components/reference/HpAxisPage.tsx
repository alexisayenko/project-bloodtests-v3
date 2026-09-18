import { COLOR } from '../../styles/tokens';
import { HP_AXIS_HTML } from './hpAxisContent';

// The one colour literal is the notation's own annotation colour, part of the diagram, not the app palette.
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

export function HpAxisPage() {
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
