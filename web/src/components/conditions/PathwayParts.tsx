import type { CSSProperties } from 'react';
import { formatMonthYear } from '../../data/months';
import { DASH, type Association, type Measure, type ReferenceInfo } from './pathwayShared';

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
