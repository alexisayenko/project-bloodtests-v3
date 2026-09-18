import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { formatMonthYear } from '../../data/months';
import { DASH, type Association, type GlyphArt, type Measure, type Particle1, type ReferenceInfo } from './pathwayShared';
import { pressable } from '../primitives/styles';

/** A diagram chip's value, its share of total T on a line of its own. */
export function ChipValue({ measure }: Readonly<{ measure: Measure }>) {
  return (
    <>
      {measure.text}
      {measure.share && <span className="mc-pathway-share">{measure.share}</span>}
    </>
  );
}

export function Cites({ scope, cites }: Readonly<{ scope: string; cites: readonly number[] }>) {
  if (cites.length === 0) return null;
  return (
    <span className="mc-pathway-cites">
      {cites.map((n) => (
        <a
          key={n}
          className="mc-pathway-cite"
          href={`#${scope}-src-${n}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(`${scope}-src-${n}`)?.scrollIntoView({ block: 'nearest' });
          }}
        >
          [{n}]
        </a>
      ))}
    </span>
  );
}

export function ReferenceBlock({ scope, info, title = 'Reference range' }: Readonly<{ scope: string; info: ReferenceInfo; title?: string }>) {
  return (
    <div className="mc-pathway-ref">
      <div className="mc-pathway-ref-head">
        <b>{title}</b>
        {info.tag && <span className="mc-pathway-ref-tag">{info.tag}</span>}
        <Cites scope={scope} cites={info.headCites} />
      </div>
      {info.lines.map((line) => (
        <div key={`${line.label ?? ''}|${line.text}`} className="mc-pathway-ref-line">
          {line.label && <span className="mc-pathway-ref-label">{line.label}</span>}
          <span className="mc-pathway-ref-value">
            {line.text}
            <Cites scope={scope} cites={line.cites} />
          </span>
        </div>
      ))}
      {info.empty && <div className="mc-pathway-ref-empty">{info.empty}</div>}
    </div>
  );
}

export function SourcesBlock({ scope, info }: Readonly<{ scope: string; info: ReferenceInfo }>) {
  if (info.sources.length === 0) return null;
  return (
    <div className="mc-pathway-sources">
      <b>Sources</b>
      <ol>
        {info.sources.map((s, i) => (
          <li key={`${s.title}|${s.url ?? ''}`} id={`${scope}-src-${i + 1}`}>
            {s.organization}.{' '}
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              s.title
            )}
            {s.year ? ` (${s.year})` : ''}
            {s.retrieved ? `, retrieved ${s.retrieved}` : ''}
            {s.quote && <q className="mc-pathway-source-quote">{s.quote}</q>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Visually hides the fieldset's legend without removing it from the accessibility tree. */
const SR_ONLY_STYLE: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
};

export function DateStepper({ dates, index, onChange }: Readonly<{ dates: readonly string[]; index: number; onChange: (index: number) => void }>) {
  const date = dates[index];
  return (
    <fieldset className="mc-pathway-stepper" style={{ margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={SR_ONLY_STYLE}>Measurement date</legend>
      <button type="button" aria-label="Previous date" disabled={index <= 0} onClick={() => onChange(index - 1)}>
        ‹
      </button>
      <span className="mc-pathway-stepper-label">{date ? formatMonthYear(date) : DASH}</span>
      <button type="button" aria-label="Next date" disabled={index >= dates.length - 1} onClick={() => onChange(index + 1)}>
        ›
      </button>
    </fieldset>
  );
}

/** The active badge's bus and target rings; an opened (focused) badge also veils everything but its targets. */
export function AssociationLayer({
  associations,
  active,
  focused,
  veil,
}: Readonly<{ associations: readonly Association[]; active: string | null; focused: string | null; veil: { w: number; h: number } | null }>) {
  return (
    <>
      {associations
        .filter((a) => a.badge === active)
        .map((a) => (
          <g key={a.badge}>
            {veil && a.badge === focused && (
              <>
                <mask id="mc-pathway-veil-mask">
                  <rect x={0} y={0} width={veil.w} height={veil.h} fill="white" />
                  {a.rings.map((g) => (
                    <circle key={`${g.cx},${g.cy}`} cx={g.cx} cy={g.cy} r={g.r} fill="black" />
                  ))}
                </mask>
                <rect className="mc-pathway-veil" x={0} y={0} width={veil.w} height={veil.h} mask="url(#mc-pathway-veil-mask)" />
              </>
            )}
            <g className="mc-pathway-assoc">
              {a.paths.map((d) => (
                <path key={d} d={d} fill="none" />
              ))}
              {a.rings.map((g) => (
                <circle key={`${g.cx},${g.cy}`} cx={g.cx} cy={g.cy} r={g.r} fill="none" />
              ))}
            </g>
          </g>
        ))}
    </>
  );
}

/** Crops the artwork to its drawn content and scales that to the art's size, so padding in the file never shrinks the glyph. */
export function Glyph({ art, alt = '' }: Readonly<{ art: GlyphArt; alt?: string }>) {
  const [left, top, right, bottom] = art.box;
  const scale = art.size / Math.max(right - left, bottom - top);
  const style: CSSProperties = {
    width: art.width * scale,
    height: art.height * scale,
    left: (art.size - (right - left) * scale) / 2 - left * scale,
    top: (art.size - (bottom - top) * scale) / 2 - top * scale,
  };
  return (
    <span className="mc-pathway-glyph" style={{ width: art.size, height: art.size }}>
      <img src={art.src} alt={alt} style={style} />
    </span>
  );
}

/** Inline rather than `.mc-lipid-enzyme-backdrop`, so this cross-page component depends on no page's CSS. */
const PARTICLE1_BACKDROP_STYLE: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: '50%',
  background: '#fff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
};

/** Caption beside the glyph only; a node wanting its caption below is not on this shape yet. */
export function Particle1Node({
  particle,
  art,
  dataNode,
  alt,
  title,
  onClick,
  children,
}: Readonly<{
  particle: Particle1;
  art: GlyphArt;
  /** The `data-node` id arrows and association lines target. */
  dataNode: string;
  alt?: string;
  title?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  /** Content rendered below the node, e.g. an enzyme's product. */
  children?: ReactNode;
}>) {
  return (
    <div className="mc-pathway-enzyme-col">
      <div
        className="mc-pathway-enzyme"
        data-node={dataNode}
        title={title}
        {...(onClick ? pressable((e) => onClick(e as unknown as Parameters<typeof onClick>[0])) : { onClick })}
      >
        {particle.backdrop ? (
          <span style={PARTICLE1_BACKDROP_STYLE}>
            <Glyph art={art} alt={alt} />
          </span>
        ) : (
          <Glyph art={art} alt={alt} />
        )}
        <span className="mc-pathway-node-label">{particle.name}</span>
      </div>
      {children && <div className="mc-pathway-product">{children}</div>}
    </div>
  );
}

/** The small muted line saying which pictures on a pathway page are illustration rather than data (ADR-0022). */
export function ArtworkNote({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="mc-pathway-art-note">{children}</div>;
}
