import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  MARKER_CANDIDATE_LOINCS,
  SI_US_UNIT,
  computeIndex,
  indexBands,
  indexZone,
  markersForIndex,
  type SubjectProfile,
} from '../../data/computedIndices';
import { DEFAULT_ALBUMIN_GDL, INDEX_DEFS, testosteronePools } from '../../data/indexDefs';
import { ALIAS_TO_PRIMARY, ALSO_REFS, DEFAULT_UNITS } from '../../data/analyteCatalog';
import { formatMonthYear } from '../../data/months';
import { PATHWAY_RANGE_SOURCE_BY_ID, pathwayRangesFor, rangeStatus, rangesInUnit } from '../../data/pathwayReferenceRanges';
import type { Result } from '../../types';
import { fmtNum, isOutOfRange } from '../../utils/format';
import { panelDates, type Observation } from './markers';
import { displayedResult, formatFullDate } from './ui';
import { hasReference, type ResultEntry } from './resultsLookup';
import { PageHeader } from './PageHeader';
import {
  BrainPituitaryIcon,
  CarrierIcon,
  HeartPulseIcon,
  HormoneIcon,
  ReceptorIcon,
  TargetTissueIcon,
  TestesIcon,
  type IconComponent,
} from './customIcons';

interface PathwaySite {
  id: string;
  title: string;
  description: string;
  Icon: IconComponent;
}

const SITES: PathwaySite[] = [
  { id: 'hp', title: 'Hypothalamus + Pituitary', description: 'Regulate and release hormones', Icon: BrainPituitaryIcon },
  { id: 'cardio', title: 'Blood Transport', description: 'Carries hormones; proteins bind and transport them', Icon: HeartPulseIcon },
  { id: 'testes', title: 'Testes', description: 'Produce sex steroids', Icon: TestesIcon },
  { id: 'target', title: 'Target tissues', description: 'Where hormones exert their effects', Icon: TargetTissueIcon },
];

const DASH = '–';

type Status = 'ok' | 'warn' | 'bad' | 'none';

interface LabRange {
  low?: number;
  high?: number;
  unit: string;
}

interface Measure {
  text: string;
  status: Status;
  /** The unit the value is shown in, when there is a reading. */
  unit?: string;
  /** The lab-printed range, in the same unit as the shown value. */
  lab?: LabRange;
}

/** The pathway is the male axis, so every range and zone here is the adult male one. */
const MALE: SubjectProfile = { sex: 'male' };

const EMPTY: Measure = { text: DASH, status: 'none' };

const FSH_LOINC = '15067-2';

function withVariants(loinc: string): string[] {
  const primary = ALIAS_TO_PRIMARY[loinc] ?? loinc;
  return [...new Set([loinc, primary, ...(ALSO_REFS[primary] ?? []).map((ref) => ref.loinc)])];
}

type MarkerKey = 'LH' | 'FSH' | 'T' | 'SHBG' | 'ALB' | 'E2' | 'DHT';
type IndexKey = 'cft' | 'biot' | 'tlh' | 'dhtt' | 'te2';
type MeasureKey = MarkerKey | IndexKey | 'shbgBound' | 'albBound';
type Snapshot = Record<MeasureKey, Measure>;

const MARKER_CODES: Record<MarkerKey, string[]> = {
  LH: MARKER_CANDIDATE_LOINCS['LH'] ?? [],
  FSH: withVariants(FSH_LOINC),
  T: MARKER_CANDIDATE_LOINCS['T'] ?? [],
  SHBG: MARKER_CANDIDATE_LOINCS['SHBG'] ?? [],
  ALB: MARKER_CANDIDATE_LOINCS['ALB'] ?? [],
  E2: MARKER_CANDIDATE_LOINCS['E2'] ?? [],
  DHT: MARKER_CANDIDATE_LOINCS['DHT'] ?? [],
};

const INDEX_KEYS: readonly IndexKey[] = ['cft', 'biot', 'tlh', 'dhtt', 'te2'];

/** The monitoring panel whose results-table dates this page steps through. */
const PANEL_NAME = 'Hypogonadism';

const defOf = (key: string) => INDEX_DEFS.find((d) => d.key === key);

/** The lab-printed bounds, converted exactly as the shown value was. */
function labRangeOf(key: MarkerKey, result: Result, unitSystem: 'si' | 'us'): LabRange {
  const place = (v: number | null) => (v == null ? undefined : displayedResult(key, { ...result, value: v }, unitSystem));
  const low = place(result.refMin);
  const high = place(result.refMax);
  return { low: low?.value ?? undefined, high: high?.value ?? undefined, unit: (low ?? high)?.unit ?? result.unit };
}

function snapshotOf(
  allResults: readonly ResultEntry[],
  resultsByDate: Record<string, Record<string, Result>>,
  date: string | undefined,
  unitSystem: 'si' | 'us',
  assumeAlbumin: boolean
): Snapshot {
  const onDate = date ? allResults.filter((e) => e.date === date && e.result.value != null) : [];
  const resultsByLoinc = (date && resultsByDate[date]) || {};
  const nmol = (v: number | undefined): Measure => (v == null ? EMPTY : { text: `${fmtNum(v)} nmol/L`, status: 'none' });

  const marker = (key: MarkerKey): Measure => {
    const hit = onDate.find((e) => MARKER_CODES[key].includes(e.loinc));
    if (!hit) return EMPTY;
    const shown = displayedResult(key, hit.result, unitSystem);
    const text = `${fmtNum(shown.value)} ${shown.unit}`.trim();
    if (hasReference(hit.result)) {
      return { text, unit: shown.unit, lab: labRangeOf(key, hit.result, unitSystem), status: isOutOfRange(hit.result) ? 'bad' : 'ok' };
    }
    const curated = pathwayRangesFor(MARKER_CODES[key]);
    const status = curated && shown.value != null ? rangeStatus(shown.value, rangesInUnit(curated, shown.unit)) : undefined;
    return { text, unit: shown.unit, status: status ?? 'none' };
  };

  const biot = defOf('biot');
  const inputs = biot ? markersForIndex(biot, resultsByLoinc) : {};
  const albumin = inputs['ALB'] ?? (assumeAlbumin ? DEFAULT_ALBUMIN_GDL : undefined);

  const index = (key: IndexKey): Measure => {
    const def = defOf(key);
    if ((key === 'cft' || key === 'biot') && albumin == null) return EMPTY;
    const value = def ? computeIndex(def, resultsByLoinc) : null;
    if (!def || value == null) return EMPTY;
    return { text: `${fmtNum(value)} ${def.unit ?? ''}`.trim(), status: indexZone(def, value, MALE) ?? 'none' };
  };

  const pools =
    inputs['T'] != null && inputs['SHBG'] != null && albumin != null
      ? testosteronePools(inputs['T'], inputs['SHBG'], albumin)
      : undefined;

  const markers = Object.fromEntries((Object.keys(MARKER_CODES) as MarkerKey[]).map((k) => [k, marker(k)]));
  const indices = Object.fromEntries(INDEX_KEYS.map((k) => [k, index(k)]));
  return {
    ...(markers as Record<MarkerKey, Measure>),
    ...(indices as Record<IndexKey, Measure>),
    shbgBound: nmol(pools?.shbgBound),
    albBound: nmol(pools?.albuminBound),
  };
}

const CARRIER_SIZE = 73;

type Subject = { kind: 'marker'; key: MarkerKey } | { kind: 'index'; key: IndexKey } | { kind: 'pool' };

const MARKER_KEYS = Object.keys(MARKER_CODES) as MarkerKey[];

function subjectOf(measure: MeasureKey): Subject {
  if ((MARKER_KEYS as string[]).includes(measure)) return { kind: 'marker', key: measure as MarkerKey };
  if ((INDEX_KEYS as readonly string[]).includes(measure)) return { kind: 'index', key: measure as IndexKey };
  return { kind: 'pool' };
}

type CaptionId = 'fsh' | 'lh' | 't' | 'shbg' | 'alb' | 'shbg-t' | 'alb-t' | 'e2' | 'e2blood' | 'dht';

interface CaptionSpec {
  /** Short face on the chip. */
  label: string;
  /** Full name heading the expanded card. */
  title: string;
  measure: MeasureKey;
  note?: string;
}

const CAPTIONS: Readonly<Record<CaptionId, CaptionSpec>> = {
  fsh: { label: 'FSH', title: 'Follicle-Stimulating Hormone', measure: 'FSH' },
  lh: { label: 'LH', title: 'Luteinizing Hormone', measure: 'LH' },
  t: { label: 'T', title: 'Free Testosterone (calculated)', measure: 'cft' },
  shbg: { label: 'SHBG', title: 'Sex Hormone-Binding Globulin', measure: 'SHBG' },
  alb: { label: 'Albumin', title: 'Albumin', measure: 'ALB' },
  'shbg-t': {
    label: 'SHBG-T', title: 'SHBG-bound Testosterone', measure: 'shbgBound',
    note: 'Not bioavailable: held tightly by SHBG, released slowly.',
  },
  'alb-t': {
    label: 'Albumin-T', title: 'Albumin-bound Testosterone', measure: 'albBound',
    note: 'Part of bioavailable T: loosely bound, released quickly in tissue capillaries (bioavailable T = free + albumin-bound).',
  },
  e2: { label: 'E2', title: 'Estradiol', measure: 'E2' },
  e2blood: { label: 'E2', title: 'Estradiol', measure: 'E2' },
  dht: { label: 'DHT', title: 'Dihydrotestosterone', measure: 'DHT' },
};

const isCaptionId = (id: string | null): id is CaptionId => id != null && id in CAPTIONS;

interface CitedSource {
  organization: string;
  title: string;
  url?: string;
  year?: number;
  retrieved?: string;
}

interface ReferenceLine {
  label?: string;
  text: string;
  cites: number[];
}

interface ReferenceInfo {
  tag?: string;
  headCites: number[];
  lines: ReferenceLine[];
  empty?: string;
  sources: CitedSource[];
}

function formatBounds(low: number | undefined, high: number | undefined, unit: string | undefined, inclusive: boolean): string {
  const u = unit ? ` ${unit}` : '';
  if (low != null && high != null) return `${fmtNum(low)} – ${fmtNum(high)}${u}`;
  if (low != null) return `${inclusive ? '≥' : '>'} ${fmtNum(low)}${u}`;
  if (high != null) return `${inclusive ? '≤' : '<'} ${fmtNum(high)}${u}`;
  return DASH;
}

function indexReference(key: IndexKey): ReferenceInfo {
  const def = defOf(key);
  const bands = def ? indexBands(def, MALE) : null;
  if (!def || !bands) return { headCites: [], lines: [], empty: 'No reference range', sources: [] };
  const u = def.unit ? ` ${def.unit}` : '';
  const [good, warn] = bands.cut.map((c) => fmtNum(c));
  const zones: [string, string][] = bands.hi
    ? [['Within range', `≥ ${good}${u}`], ['Borderline', `${warn} – ${good}${u}`], ['Low', `< ${warn}${u}`]]
    : [['Within range', `< ${good}${u}`], ['Borderline', `${good} – ${warn}${u}`], ['High', `≥ ${warn}${u}`]];
  const sources = def.references.map((r) => ({ organization: r.organization, title: r.document, url: r.url, year: r.year, retrieved: r.retrieved }));
  return {
    tag: 'Guide zones, adult men',
    headCites: sources.map((_, i) => i + 1),
    lines: zones.map(([label, text]) => ({ label, text, cites: [] })),
    sources,
  };
}

function curatedReference(key: MarkerKey, measure: Measure, unitSystem: 'si' | 'us'): ReferenceInfo {
  const marker = pathwayRangesFor(MARKER_CODES[key]);
  if (!marker) return { headCites: [], lines: [], empty: 'No reference range', sources: [] };
  const catalogUnit = marker.loincs.map((l) => DEFAULT_UNITS[l]).find((u) => u && rangesInUnit(marker, u).every((r) => r.placed));
  const unit = measure.unit ?? SI_US_UNIT[key]?.[unitSystem] ?? catalogUnit;
  const ids: string[] = [];
  const sources: CitedSource[] = [];
  const cite = (id: string) => {
    if (!ids.includes(id)) {
      const s = PATHWAY_RANGE_SOURCE_BY_ID[id];
      ids.push(id);
      sources.push({ organization: s.organization, title: s.title, url: s.url, year: s.year, retrieved: s.retrieved });
    }
    return ids.indexOf(id) + 1;
  };
  const lines = rangesInUnit(marker, unit).map((r) => ({
    label: r.population,
    text: formatBounds(r.low, r.high, r.unit, true),
    cites: r.sources.map(cite),
  }));
  return { headCites: [], lines, sources };
}

function referenceOf(measureKey: MeasureKey, snapshot: Snapshot, unitSystem: 'si' | 'us'): ReferenceInfo {
  const subject = subjectOf(measureKey);
  if (subject.kind === 'pool') return { headCites: [], lines: [], empty: 'No reference range (calculated pool)', sources: [] };
  if (subject.kind === 'index') return indexReference(subject.key);
  const measure = snapshot[subject.key];
  if (measure.lab) {
    const { low, high, unit } = measure.lab;
    return { tag: 'From the lab report', headCites: [], lines: [{ text: formatBounds(low, high, unit, false), cites: [] }], sources: [] };
  }
  return curatedReference(subject.key, measure, unitSystem);
}

function Cites({ scope, cites }: Readonly<{ scope: string; cites: readonly number[] }>) {
  return (
    <>
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
    </>
  );
}

function ReferenceBlock({ scope, info }: Readonly<{ scope: string; info: ReferenceInfo }>) {
  return (
    <div className="mc-pathway-ref">
      <div className="mc-pathway-ref-head">
        <b>Reference range</b>
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
      {info.sources.length > 0 && (
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
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

interface PathwayState {
  open: string | null;
  snapshot: Snapshot;
  toggleCaption: (id: CaptionId, chip: HTMLElement) => void;
}

const PathwayContext = createContext<PathwayState | null>(null);

function Caption({ id }: Readonly<{ id: CaptionId }>) {
  const state = useContext(PathwayContext);
  if (!state) return null;
  const spec = CAPTIONS[id];
  const measure = state.snapshot[spec.measure];
  const expanded = state.open === id;
  return (
    <button
      type="button"
      className={expanded ? 'mc-pathway-caption mc-pathway-chip mc-pathway-chip-open' : 'mc-pathway-caption mc-pathway-chip'}
      data-caption={id}
      aria-expanded={expanded}
      onClick={(e) => state.toggleCaption(id, e.currentTarget)}
    >
      <span className="mc-pathway-chip-head">
        <span className="mc-pathway-node-label">{spec.label}</span>
        <span className={`mc-pathway-dot mc-pathway-dot-${measure.status}`} />
      </span>
      <span className="mc-pathway-node-value">{measure.text}</span>
    </button>
  );
}

const CARD_WIDTH = 300;

function CaptionCard({ id, left, top, snapshot, date, unitSystem }: Readonly<{ id: CaptionId; left: number; top: number; snapshot: Snapshot; date: string | undefined; unitSystem: 'si' | 'us' }>) {
  const spec = CAPTIONS[id];
  const measure = snapshot[spec.measure];
  return (
    <div className="mc-pathway-pop" role="dialog" aria-label={spec.title} style={{ left, top, width: CARD_WIDTH }}>
      <div className="mc-pathway-pop-title">{spec.title}</div>
      <div className="mc-pathway-pop-facts">
        <span><b>Value</b> {measure.text}</span>
        <span><b>Date</b> {date ? formatFullDate(date) : DASH}</span>
      </div>
      {spec.note && <p className="mc-pathway-pop-note">{spec.note}</p>}
      <ReferenceBlock scope={`pathway-${id}`} info={referenceOf(spec.measure, snapshot, unitSystem)} />
    </div>
  );
}

interface DockedCarrier {
  protein: CaptionId;
  bound: CaptionId;
  boundSide: 'left' | 'right';
}

function Carrier({ carrier }: Readonly<{ carrier: DockedCarrier }>) {
  const protein = (
    <div className="mc-pathway-anchor">
      <CarrierIcon size={CARRIER_SIZE} />
      <Caption id={carrier.protein} />
    </div>
  );
  const bound = (
    <div className="mc-pathway-anchor" style={{ height: CARRIER_SIZE, alignItems: 'center' }} data-node={carrier.bound}>
      <span className="mc-pathway-bubble">
        <HormoneIcon size={24} />
      </span>
      <Caption id={carrier.bound} />
    </div>
  );
  const right = carrier.boundSide === 'right';
  return (
    <div className={right ? 'mc-pathway-docked' : 'mc-pathway-docked mc-pathway-docked-left'}>
      {right ? protein : bound}
      <span className="mc-pathway-bond" />
      {right ? bound : protein}
    </div>
  );
}

function Exchange() {
  return (
    <svg className="mc-pathway-exchange" viewBox="0 0 100 14" preserveAspectRatio="none" aria-label="exchanges with" role="img">
      <path d="M2 4H98M92 1l6 3" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      <path d="M98 10H2M8 13l-6-3" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

function Hormone({ id, slot }: Readonly<{ id: CaptionId; slot?: boolean }>) {
  return (
    <div className={slot ? 'mc-pathway-anchor mc-pathway-node mc-pathway-slot' : 'mc-pathway-anchor mc-pathway-node'} data-node={id}>
      <HormoneIcon size={39} />
      <Caption id={id} />
    </div>
  );
}

function Cells({ label, node }: Readonly<{ label: string; node: string }>) {
  return (
    <div className="mc-pathway-anchor mc-pathway-node mc-pathway-slot" data-node={node}>
      <img src="/pathways/leydig-cells.png" alt="" width={56} height={56} />
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{label}</span>
      </div>
    </div>
  );
}

function TestesDiagram() {
  return (
    <div className="mc-pathway-row mc-pathway-row-start">
      <Cells label="Sertoli Cells" node="sertoli" />
      <Cells label="Leydig Cells" node="leydig" />
    </div>
  );
}

function Enzyme({ label, node, children }: Readonly<{ label: string; node: string; children?: ReactNode }>) {
  return (
    <div className="mc-pathway-enzyme-col">
      <div className="mc-pathway-enzyme" data-node={node}>
        <img src="/pathways/enzyme.png" alt="" width={44} height={44} />
        <span className="mc-pathway-node-label">{label}</span>
      </div>
      {children && <div className="mc-pathway-product">{children}</div>}
    </div>
  );
}

function Receptor({ label, node }: Readonly<{ label: string; node: string }>) {
  return (
    <div className="mc-pathway-anchor mc-pathway-node" data-node={node}>
      <ReceptorIcon size={36} />
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{label}</span>
      </div>
    </div>
  );
}

function TargetDiagram() {
  return (
    <div className="mc-pathway-row mc-pathway-row-start">
      <div className="mc-pathway-enzymes">
        <Enzyme label="5α-reductase" node="srd5a">
          <Hormone id="dht" />
        </Enzyme>
        <Enzyme label="aromatase" node="aromatase">
          <Hormone id="e2" />
        </Enzyme>
        <div className="mc-pathway-er">
          <Receptor label="Estrogen receptors" node="er" />
        </div>
        <div className="mc-pathway-ar">
          <Receptor label="Androgen receptors" node="ar" />
        </div>
      </div>
    </div>
  );
}

const SHBG_CARRIER: DockedCarrier = { protein: 'shbg', bound: 'shbg-t', boundSide: 'right' };
const ALBUMIN_CARRIER: DockedCarrier = { protein: 'alb', bound: 'alb-t', boundSide: 'left' };

function CardioDiagram() {
  return (
    <div className="mc-pathway-row mc-pathway-row-start">
      <Hormone id="fsh" slot />
      <Hormone id="lh" slot />
      <div className="mc-pathway-group">
        <Carrier carrier={SHBG_CARRIER} />
        <Exchange />
        <Hormone id="t" />
        <Exchange />
        <Carrier carrier={ALBUMIN_CARRIER} />
      </div>
      <div className="mc-pathway-e2blood">
        <Hormone id="e2blood" />
      </div>
    </div>
  );
}

const PATHWAYS: ReadonlyArray<readonly [string, string, 'straight' | 'elbow' | 'drop']> = [
  ['lh', 'leydig', 'straight'],
  ['fsh', 'sertoli', 'straight'],
  ['leydig', 't', 'elbow'],
  ['aromatase', 'e2', 'straight'],
  ['srd5a', 'dht', 'straight'],
  ['e2', 'e2blood', 'elbow'],
  ['e2blood', 'er', 'drop'],
];

type Line = string;

function roundedPath(points: string, radius = 10): string {
  const pts = points.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ax = cx - ((cx - px) / inLen) * r;
    const ay = cy - ((cy - py) / inLen) * r;
    const bx = cx + ((nx - cx) / outLen) * r;
    const by = cy + ((ny - cy) / outLen) * r;
    d += ` L${ax},${ay} Q${cx},${cy} ${bx},${by}`;
  }
  const last = pts.at(-1) ?? pts[0];
  return `${d} L${last[0]},${last[1]}`;
}

const ASSOCIATIONS: Readonly<Record<string, readonly string[]>> = {
  'total-t': ['shbg-t', 't', 'alb-t'],
  'free-t': ['t'],
  'bio-t': ['t', 'alb-t'],
  tlh: ['leydig'],
  dhtt: ['srd5a'],
  't-e2': ['aromatase'],
};

interface Association {
  badge: string;
  paths: string[];
  rings: { cx: number; cy: number; r: number }[];
}

function PathwayArrows({ root, active, focused, layoutKey }: Readonly<{ root: RefObject<HTMLDivElement | null>; active: string | null; focused: string | null; layoutKey: string }>) {
  const [lines, setLines] = useState<Line[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [veil, setVeil] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const centerX = (r: DOMRect) => r.left + r.width / 2 - base.left;
      const fork = (from: string, targets: string[]): Line[] => {
        const a = el.querySelector(`[data-node="${from}"]`);
        const icons = targets.map((t) => el.querySelector(`[data-node="${t}"] img`)).filter((n): n is Element => n !== null);
        if (!a || icons.length === 0) return [];
        const x = centerX(a.getBoundingClientRect()) + 8;
        const y1 = (a.querySelector('.mc-pathway-caption') ?? a).getBoundingClientRect().bottom - base.top + 5;
        const rects = icons.map((i) => i.getBoundingClientRect());
        const junction = Math.min(...rects.map((r) => r.top)) - base.top - 28;
        return [
          `trunk:${x},${y1} ${x},${junction}`,
          ...rects.map((r) => `${x},${junction - 12} ${x},${junction} ${centerX(r)},${junction} ${centerX(r)},${r.top - base.top - 4}`),
        ];
      };
      const tNode = el.querySelector('[data-node="t"]');
      const enzymes = el.querySelector<HTMLElement>('.mc-pathway-enzymes');
      if (tNode && enzymes) {
        enzymes.style.transform = '';
        const imgs = [...enzymes.querySelectorAll('img')].map((i) => i.getBoundingClientRect());
        if (imgs.length === 2) {
          const mid = (centerX(imgs[0]) + centerX(imgs[1])) / 2;
          const containerLeft = enzymes.getBoundingClientRect().left - base.left;
          const ar = enzymes.querySelector<HTMLElement>('.mc-pathway-ar');
          if (ar) ar.style.left = `${mid - containerLeft - ar.offsetWidth / 2}px`;
          enzymes.style.transform = `translateX(${centerX(tNode.getBoundingClientRect()) + 8 - mid}px)`;
          const er = enzymes.querySelector<HTMLElement>('.mc-pathway-er');
          const e2 = el.querySelector('[data-node="e2"]');
          const e2blood = el.querySelector('[data-node="e2blood"]');
          if (er && e2 && e2blood) {
            const box = enzymes.getBoundingClientRect();
            const e2Rect = e2.getBoundingClientRect();
            er.style.left = `${centerX(e2blood.getBoundingClientRect()) + base.left + 48 - box.left}px`;
            er.style.top = `${e2Rect.top + e2Rect.height / 2 - box.top - er.offsetHeight / 2}px`;
          }
        }
      }
      const extra: Line[] = [];
      const trunkNode = el.querySelector('[data-node="t"]');
      const arNode = el.querySelector('[data-node="ar"]');
      const dhtNode = el.querySelector('[data-node="dht"]');
      if (trunkNode && arNode) {
        const x = centerX(trunkNode.getBoundingClientRect()) + 8;
        const arRect = arNode.getBoundingClientRect();
        const firstEnzyme = el.querySelector('[data-node="srd5a"] img');
        const junction = (firstEnzyme?.getBoundingClientRect().top ?? arRect.top) - base.top - 28;
        extra.push(`trunk:${x},${junction} ${x},${arRect.top - base.top - 4}`);
        extra.push(`${x},${arRect.top - base.top - 12} ${x},${arRect.top - base.top - 4}`);
        if (dhtNode) {
          const d = dhtNode.getBoundingClientRect();
          const dBottom = (dhtNode.querySelector('.mc-pathway-caption') ?? dhtNode).getBoundingClientRect().bottom - base.top + 5;
          const midY = arRect.top + arRect.height / 2 - base.top;
          const fromLeft = centerX(d) < centerX(arRect);
          const arEdge = fromLeft ? arRect.left - base.left - 4 : arRect.right - base.left + 4;
          extra.push(`${centerX(d)},${dBottom} ${centerX(d)},${midY} ${arEdge},${midY}`);
        }
      }
      const bandsBox = el.querySelector('.mc-pathway-bands')?.getBoundingClientRect();
      if (bandsBox) setVeil({ w: bandsBox.right - base.left, h: bandsBox.bottom - base.top });
      setAssociations(
        Object.entries(ASSOCIATIONS).flatMap(([badge, targets]) => {
          const badgeEl = el.querySelector(`[data-badge="${badge}"]`);
          if (!badgeEl) return [];
          const br = badgeEl.getBoundingClientRect();
          const bx = br.left - base.left;
          const by = br.top + 20 - base.top;
          const rings = targets.flatMap((target) => {
            const node = el.querySelector(`[data-node="${target}"]`);
            if (!node) return [];
            const r = (node.querySelector('img, svg, .mc-pathway-bubble') ?? node).getBoundingClientRect();
            return [{ cx: r.left + r.width / 2 - base.left, cy: r.top + r.height / 2 - base.top, r: Math.max(r.width, r.height) / 2 + 6 }];
          });
          if (rings.length === 0) return [];
          const lane = Math.min(...rings.map((g) => g.cy - g.r)) - 16;
          const rightmost = Math.max(...rings.map((g) => g.cx));
          const leftmost = Math.min(...rings.map((g) => g.cx));
          const turn = Math.max(rightmost + 24, bx - 24);
          const paths = [
            roundedPath(`${bx},${by} ${turn},${by} ${turn},${lane} ${leftmost},${lane}`, 12),
            ...rings.map((g) => `M${g.cx},${lane} L${g.cx},${g.cy - g.r}`),
          ];
          return [{ badge, paths, rings }];
        }),
      );
      setLines([
        ...extra,
        ...fork('t', ['aromatase', 'srd5a']),
        ...PATHWAYS.flatMap(([from, to, shape]) => {
          const a = el.querySelector(`[data-node="${from}"]`);
          const b = el.querySelector(`[data-node="${to}"]`);
          if (!a || !b) return [];
          const ra = (a.classList.contains('mc-pathway-enzyme') ? (a.querySelector('img') ?? a) : a).getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const bottomOf = (node: Element) => (node.querySelector('.mc-pathway-caption') ?? node).getBoundingClientRect().bottom - base.top + 5;
          const down = rb.top >= ra.top;
          const x2 = centerX(rb) - (shape === 'elbow' ? 8 : 0);
          const y2 = down ? rb.top - base.top - 4 : bottomOf(b);
          if (shape === 'elbow') {
            const midY = ra.top + ra.height / 2 - base.top;
            const inset = a.classList.contains('mc-pathway-slot') ? 18 : -4;
            const x1 = x2 >= centerX(ra) ? ra.right - base.left - inset : ra.left - base.left + inset;
            return [`${x1},${midY} ${x2},${midY} ${x2},${y2}`];
          }
          if (shape === 'drop') {
            const x = centerX(ra) + 8;
            const midY = rb.top + rb.height / 2 - base.top;
            const edge = x < centerX(rb) ? rb.left - base.left - 4 : rb.right - base.left + 4;
            return [`${x},${bottomOf(a)} ${x},${midY} ${edge},${midY}`];
          }
          return [`${centerX(ra)},${down ? bottomOf(a) : ra.top - base.top - 4} ${x2},${y2}`];
        }),
      ]);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [root, layoutKey]);

  return (
    <svg className="mc-pathway-overlay" aria-hidden="true">
      <defs>
        <marker id="mc-pathway-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="currentColor" />
        </marker>
      </defs>
      {lines.map((line) => {
        const trunk = line.startsWith('trunk:');
        return (
          <path
            key={line}
            d={roundedPath(trunk ? line.slice(6) : line)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            strokeLinejoin="round"
            markerEnd={trunk ? undefined : 'url(#mc-pathway-head)'}
          />
        );
      })}
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
    </svg>
  );
}

interface Badge {
  id: string;
  name: string;
  measure: MeasureKey;
  meaning: string;
  low: string;
  high: string;
  caveats: string;
}

const BADGES: ReadonlyArray<Badge> = [
  {
    id: 'total-t', name: 'Total Testosterone', measure: 'T',
    meaning: 'All testosterone in blood: SHBG-bound, albumin-bound and free.',
    low: 'Less testosterone made, or less SHBG holding it.',
    high: 'More made, or more SHBG holding it (free T may still be normal).',
    caveats: 'Peaks in the morning; SHBG changes it without changing free T.',
  },
  {
    id: 'free-t', name: 'Free Testosterone', measure: 'cft',
    meaning: 'The unbound share (about 1–3%) that can enter cells. Calculated from total T, SHBG and albumin (Vermeulen).',
    low: 'Less testosterone available to tissues.',
    high: 'More available to tissues.',
    caveats: 'Direct free-T immunoassays are unreliable; the calculation is preferred.',
  },
  {
    id: 'bio-t', name: 'Bioavailable Testosterone', measure: 'biot',
    meaning: 'Free plus albumin-bound testosterone — the part not locked to SHBG.',
    low: 'Less testosterone reaching tissues.',
    high: 'More reaching tissues.',
    caveats: 'Calculated; reference bands depend on sex and age.',
  },
  {
    id: 'tlh', name: 'T/LH', measure: 'tlh',
    meaning: 'How much testosterone the Leydig cells make per unit of LH stimulus.',
    low: 'The testes respond poorly (primary or compensated hypogonadism).',
    high: 'A strong testicular response.',
    caveats: 'LH is pulsatile, so one sample is noisy; no agreed reference range.',
  },
  {
    id: 'dhtt', name: 'DHT/T', measure: 'dhtt',
    meaning: 'Share of testosterone converted to DHT — a rough gauge of 5α-reductase activity.',
    low: 'Less conversion (e.g. finasteride, dutasteride).',
    high: 'More conversion.',
    caveats: 'Serum DHT understates tissue DHT; LC-MS/MS assays are more reliable.',
  },
  {
    id: 't-e2', name: 'T/E2', measure: 'te2',
    meaning: 'Testosterone left relative to estradiol made from it — aromatase balance.',
    low: 'More aromatization (often more body fat).',
    high: 'Less aromatization.',
    caveats: 'E2 immunoassays are unreliable at male levels; units matter.',
  },
];

function Badges({
  snapshot,
  unitSystem,
  open,
  setOpen,
  setHovered,
}: Readonly<{ snapshot: Snapshot; unitSystem: 'si' | 'us'; open: string | null; setOpen: (id: string | null) => void; setHovered: (id: string | null) => void }>) {
  return (
    <aside className="mc-pathway-badges" aria-label="Measures and ratios">
      {BADGES.map((b) => {
        const expanded = open === b.id;
        return (
          <div
            key={b.id}
            className={expanded ? 'mc-pathway-badge mc-pathway-badge-open' : 'mc-pathway-badge'}
            data-badge={b.id}
            onMouseEnter={() => setHovered(b.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <button
              type="button"
              className="mc-pathway-badge-toggle"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : b.id)}
              onFocus={() => setHovered(b.id)}
              onBlur={() => setHovered(null)}
            >
              <span className="mc-pathway-badge-head">
                <span className="mc-pathway-badge-name">{b.name}</span>
                <span className={`mc-pathway-dot mc-pathway-dot-${snapshot[b.measure].status}`} />
              </span>
              <span className="mc-pathway-badge-value">{snapshot[b.measure].text}</span>
            </button>
            {expanded && (
              <div className="mc-pathway-badge-body">
                <span><b>Meaning</b> {b.meaning}</span>
                <span><b>Low</b> {b.low}</span>
                <span><b>High</b> {b.high}</span>
                <span><b>Caveats</b> {b.caveats}</span>
                <ReferenceBlock scope={`pathway-${b.id}`} info={referenceOf(b.measure, snapshot, unitSystem)} />
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

function DateStepper({ dates, index, onChange }: Readonly<{ dates: readonly string[]; index: number; onChange: (index: number) => void }>) {
  const date = dates[index];
  return (
    <div className="mc-pathway-stepper" role="group" aria-label="Measurement date">
      <button type="button" aria-label="Previous date" disabled={index <= 0} onClick={() => onChange(index - 1)}>
        ‹
      </button>
      <span className="mc-pathway-stepper-label">{date ? formatMonthYear(date) : DASH}</span>
      <button type="button" aria-label="Next date" disabled={index >= dates.length - 1} onClick={() => onChange(index + 1)}>
        ›
      </button>
    </div>
  );
}

export function HormonalPathwaysView({
  allResults,
  resultsByDate,
  panelTests,
  unitSystem,
}: Readonly<{
  allResults: readonly ResultEntry[];
  resultsByDate: Record<string, Record<string, Result>>;
  /** The Hypogonadism panel's observations, whose results-table dates the stepper lists. */
  panelTests: readonly Observation[];
  unitSystem: 'si' | 'us';
}>) {
  const bandsRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [cardAt, setCardAt] = useState<{ left: number; top: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [assumeAlbumin, setAssumeAlbumin] = useState(true);
  const dates = useMemo(() => panelDates(PANEL_NAME, panelTests, allResults).reverse(), [panelTests, allResults]);
  const date = picked && dates.includes(picked) ? picked : dates.at(-1);
  const snapshot = useMemo(
    () => snapshotOf(allResults, resultsByDate, date, unitSystem, assumeAlbumin),
    [allResults, resultsByDate, date, unitSystem, assumeAlbumin]
  );

  const placeCard = (chip: Element) => {
    const layout = bandsRef.current;
    if (!layout) return null;
    const a = chip.getBoundingClientRect();
    const box = layout.getBoundingClientRect();
    const left = Math.min(Math.max(a.left + a.width / 2 - box.left - CARD_WIDTH / 2, 0), Math.max(box.width - CARD_WIDTH, 0));
    return { left, top: a.bottom - box.top + 6 };
  };

  const toggleCaption = (id: CaptionId, chip: HTMLElement) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setCardAt(placeCard(chip));
    setOpen(id);
  };

  useEffect(() => {
    if (open === null) return;
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('.mc-pathway-pop, [data-caption], [data-badge]')) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    const onResize = () => {
      const chip = bandsRef.current?.querySelector(`[data-caption="${open}"]`);
      if (chip) setCardAt(placeCard(chip));
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const badgeOpen = isCaptionId(open) ? null : open;
  const state: PathwayState = { open, snapshot, toggleCaption };
  return (
    <div>
      <PageHeader
        overline="Endocrinology"
        titlePrimary="Hormonal"
        titleAccent="Pathways"
        description={['Biochemical pathways of hormones']}
      />
      <div className="mc-pathway-toolbar">
        <DateStepper dates={dates} index={date ? dates.indexOf(date) : -1} onChange={(i) => setPicked(dates[i] ?? null)} />
        <label className="mc-pathway-check">
          <input type="checkbox" checked={assumeAlbumin} onChange={(e) => setAssumeAlbumin(e.target.checked)} />
          Use albumin {unitSystem === 'si' ? `${fmtNum(DEFAULT_ALBUMIN_GDL * 10)} g/L` : `${fmtNum(DEFAULT_ALBUMIN_GDL)} g/dL`} when not measured
        </label>
      </div>
      <PathwayContext.Provider value={state}>
      <div className="mc-pathway-layout" ref={bandsRef}>
      <PathwayArrows root={bandsRef} active={hovered ?? badgeOpen} focused={badgeOpen} layoutKey={`${date ?? ''}|${unitSystem}`} />
      <div className="mc-pathway-bands">
        {SITES.map(({ id, title, description }) => (
          <section key={id} className="mc-pathway-band" aria-label={title}>
            <div className="mc-pathway-site">
              <h2 className="mc-pathway-title" title={description}>{title}</h2>
            </div>
            <div className="mc-pathway-diagram">
              {id === 'cardio' && <CardioDiagram />}
              {id === 'testes' && <TestesDiagram />}
              {id === 'target' && <TargetDiagram />}
            </div>
          </section>
        ))}
      </div>
      <Badges snapshot={snapshot} unitSystem={unitSystem} open={open} setOpen={setOpen} setHovered={setHovered} />
      {isCaptionId(open) && cardAt && (
        <CaptionCard id={open} left={cardAt.left} top={cardAt.top} snapshot={snapshot} date={date} unitSystem={unitSystem} />
      )}
      </div>
      </PathwayContext.Provider>
    </div>
  );
}
