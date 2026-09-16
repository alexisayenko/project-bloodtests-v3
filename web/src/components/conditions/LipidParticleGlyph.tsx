import { LIPID } from '../../styles/tokens';
import { shareRange, type LipoproteinParticle, type ShareRange } from '../../data/lipoproteinParticles';
import { GLYPH_SIZE, blobPolygon, organicRegions, polygonPath } from './lipidParticleGeometry';

const SHELL_INSET = 7;
const PILL_H = 14;

/** A particle drawn from its sourced shares: TRIG and Chol areas at the midpoint of the printed figures, an unsourced share left empty. */
export function ParticleGlyph({ particle }: Readonly<{ particle: LipoproteinParticle }>) {
  const size = GLYPH_SIZE[particle.id] ?? 120;
  const r = size / 2;
  const [holder, linked] = particle.structuralApolipoproteins;
  const pad = 6;
  const cx = r + pad;
  const cy = r + pad;
  const width = size + 2 * pad;
  const height = size + 2 * pad + (linked ? 22 : PILL_H / 2);
  const outer = blobPolygon(cx, cy, r, particle.id);
  const inner = blobPolygon(cx, cy, r - SHELL_INSET, particle.id);

  const trig = shareRange(particle, 'triglyceride');
  const chol = shareRange(particle, 'cholesterol');
  const parts: { key: string; name: string; range: ShareRange; fill: string }[] = [];
  if (trig) parts.push({ key: 'trig', name: 'TRIG', range: trig, fill: LIPID.trig });
  if (chol) parts.push({ key: 'chol', name: 'Chol', range: chol, fill: LIPID.chol });
  const regions = organicRegions(
    inner,
    parts.map((p) => p.range.midpoint / 100),
    { gap: 2.5, amplitude: Math.max(2, size * 0.025), seed: particle.id }
  );

  const pillW = Math.max(30, size * 0.3);
  const pillY = cy + r - SHELL_INSET / 2;
  const linkedY = pillY + 20;
  const linkedX = cx + pillW * 0.35;
  const percent = (range: ShareRange) => (range.min === range.max ? `${range.min}%` : `${range.min}–${range.max}%`);
  const summary = parts.length
    ? parts.map((p) => `${p.name} ${percent(p.range)}`).join(', ') + ' of particle mass'
    : 'composition not sourced';

  return (
    <svg data-node={particle.id} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${particle.name}: ${summary}`} style={{ display: 'block' }}>
      <title>{`${particle.name} — ${summary}`}</title>
      <path d={polygonPath(outer)} fill={LIPID.shell} stroke={LIPID.outline} strokeWidth={3} strokeLinejoin="round" />
      <path d={polygonPath(inner)} fill="none" stroke={LIPID.outline} strokeWidth={1.1} strokeLinejoin="round" />
      {parts.map((p, i) =>
        regions[i]?.length ? (
          <path key={p.key} data-node={`${particle.id}-${p.key}`} d={polygonPath(regions[i])} fill={p.fill} stroke={LIPID.outline} strokeWidth={1.8} strokeLinejoin="round">
            <title>{`${p.name} · ${percent(p.range)} of particle mass`}</title>
          </path>
        ) : null
      )}
      {linked && <line x1={linkedX} y1={pillY + PILL_H / 2} x2={linkedX} y2={linkedY - PILL_H / 2} stroke={LIPID.outline} strokeWidth={1.6} />}
      <rect data-node={`${particle.id}-apo`} x={cx - pillW / 2} y={pillY - PILL_H / 2} width={pillW} height={PILL_H} rx={PILL_H / 2} fill={LIPID.apo} stroke={LIPID.outline} strokeWidth={1.8}>
        <title>{holder}</title>
      </rect>
      {linked && (
        <rect data-node={`${particle.id}-apoa`} x={linkedX - pillW * 0.4} y={linkedY - PILL_H / 2} width={pillW * 0.8} height={PILL_H} rx={PILL_H / 2} fill={LIPID.apo} stroke={LIPID.outline} strokeWidth={1.8}>
          <title>{linked}</title>
        </rect>
      )}
    </svg>
  );
}
