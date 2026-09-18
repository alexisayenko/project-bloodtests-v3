import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  MARKER_CANDIDATE_LOINCS,
  computeIndex,
  indexBands,
  indexZone,
  markersForIndex,
  type IndexDef,
  type SubjectProfile,
} from '../../data/computedIndices';
import { DEFAULT_ALBUMIN_GDL, INDEX_DEFS, TESTOSTERONE_MOLAR_MASS, testosteronePools } from '../../data/indexDefs';
import { DEFAULT_UNITS } from '../../data/analyteCatalog';
import {
  PATHWAY_RANGE_SOURCE_BY_ID,
  convertConcentration,
  pathwayRangesFor,
  rangeStatus,
  rangesInUnit,
} from '../../data/pathwayReferenceRanges';
import { numberedEffects, receptorById } from '../../data/pathwayReceptorEffects';
import type { Result, UnitSystem } from '../../types';
import { fmtNum, formatFullDate, isOutOfRange } from '../../utils/format';
import { clamp } from '../../utils/math';
import { panelDates, type Observation } from './markers';
import { displayedResult } from './ui';
import { hasReference, nearestEntryTo, type ResultEntry } from './resultsLookup';
import { PageHeader } from './PageHeader';
import { CARD_WIDTH, DASH, EMPTY, NO_REFERENCE, formatBounds, labReference, useDismiss, valueText, combinedZones, keepSources, mergeReferences, withVariants, zoneReference, associationFor, ENZYME_ART, SIZE, type GlyphArt, type Particle1, roundedPath, useMeasuredLayout, type Association, type CitedSource, type LabRange, type Measure, type ReferenceInfo } from './pathwayShared';
import { ArtworkNote, AssociationLayer, ChipValue, Glyph, Cites, DateStepper, Particle1Node, ReferenceBlock, SourcesBlock } from './PathwayParts';
import { SegmentedControl } from '../primitives';
import {
  BrainPituitaryIcon,
  CarrierIcon,
  HeartPulseIcon,
  HormoneIcon,
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
  { id: 'hp', title: 'Brain', description: 'Regulate and release hormones', Icon: BrainPituitaryIcon },
  { id: 'cardio', title: 'Blood Transport', description: 'Carries hormones; proteins bind and transport them', Icon: HeartPulseIcon },
  { id: 'testes', title: 'Testes', description: 'Produce sex steroids', Icon: TestesIcon },
  { id: 'target', title: 'Target tissues', description: 'Where hormones exert their effects', Icon: TargetTissueIcon },
];

/** The pathway is the male axis, so every range and zone here is the adult male one. */
const MALE: SubjectProfile = { sex: 'male' };

const FSH_LOINC = '15067-2';

type MarkerKey = 'LH' | 'FSH' | 'T' | 'SHBG' | 'ALB' | 'E2' | 'DHT' | 'FT';
type IndexKey = 'cft' | 'cftlh' | 'biot' | 'tlh' | 'dhtt' | 'te2';
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
  FT: MARKER_CANDIDATE_LOINCS['FT'] ?? [],
};

const INDEX_KEYS: readonly IndexKey[] = ['cft', 'cftlh', 'biot', 'tlh', 'dhtt', 'te2'];

/** The monitoring panel whose results-table dates this page steps through. */
const PANEL_NAME = 'Hypogonadism';

const defOf = (key: string) => INDEX_DEFS.find((d) => d.key === key);

/** The unit each quantity is shown in per unit system, and the molar mass a mass↔molar step needs; anything absent keeps its own unit. */
const DISPLAY_UNITS: Partial<Record<MeasureKey, { si: string; us: string; molarMass?: string }>> = {
  T: { si: 'nmol/L', us: 'ng/dL', molarMass: 'testosterone' },
  FT: { si: 'pmol/L', us: 'pg/mL', molarMass: 'testosterone' },
  cft: { si: 'pmol/L', us: 'pg/mL', molarMass: 'testosterone' },
  cftlh: { si: 'pmol/L', us: 'pg/mL', molarMass: 'testosterone' },
  biot: { si: 'nmol/L', us: 'ng/dL', molarMass: 'testosterone' },
  shbgBound: { si: 'nmol/L', us: 'ng/dL', molarMass: 'testosterone' },
  albBound: { si: 'nmol/L', us: 'ng/dL', molarMass: 'testosterone' },
  E2: { si: 'pmol/L', us: 'pg/mL', molarMass: 'estradiol' },
  DHT: { si: 'nmol/L', us: 'ng/dL' },
  ALB: { si: 'g/L', us: 'g/dL' },
};

/** The fractions of total testosterone shown with their share of it. */
const SHARE_KEYS: readonly MeasureKey[] = ['FT', 'cft', 'cftlh', 'biot', 'shbgBound', 'albBound'];

/** The value in this unit system's unit, or as given when no exact conversion exists (ADR-0003). */
function inDisplayUnit(key: MeasureKey, value: number, unit: string, unitSystem: UnitSystem): { value: number; unit: string } {
  const target = DISPLAY_UNITS[key];
  const to = target?.[unitSystem];
  const converted = to ? convertConcentration(value, unit, to, target?.molarMass) : undefined;
  return converted === undefined || !to ? { value, unit } : { value: converted, unit: to };
}

const formatShare = (percent: number) => `${percent.toFixed(percent < 1 ? 2 : 1)}%`;

/** The lab-printed bounds, converted exactly as the shown value was. */
function labRangeOf(key: MarkerKey, result: Result, unit: string, unitSystem: UnitSystem): LabRange {
  const place = (v: number | null) => (v == null ? undefined : inDisplayUnit(key, v, unit, unitSystem));
  const low = place(result.refMin);
  const high = place(result.refMax);
  return { low: low?.value, high: high?.value, unit: (low ?? high)?.unit ?? unit };
}

/** Exclusive choices for a draw with no albumin reading, not a cascade; a same-draw reading always wins. */
const ALBUMIN_FALLBACKS = ['none', 'nearest', 'default'] as const;
type AlbuminFallback = (typeof ALBUMIN_FALLBACKS)[number];

function albuminFallbackLabel(fallback: AlbuminFallback, unitSystem: UnitSystem): string {
  switch (fallback) {
    case 'none':
      return "Don't use a fallback";
    case 'nearest':
      return 'Use the nearest measured albumin';
    case 'default': {
      const amount = unitSystem === 'si' ? `${fmtNum(DEFAULT_ALBUMIN_GDL * 10)} g/L` : `${fmtNum(DEFAULT_ALBUMIN_GDL)} g/dL`;
      return `Use ${amount}`;
    }
  }
}

/** issam.ch's calculator converts T at ~280 g/mol (T / 2.8 × 1e-10); offered only to reproduce its figures (ADR-0020). */
const T_MOLAR_MASSES = ['pubchem', 'issam'] as const;
type TMolarMass = (typeof T_MOLAR_MASSES)[number];
const T_MOLAR_MASS_GPERMOL: Record<TMolarMass, number> = { pubchem: TESTOSTERONE_MOLAR_MASS, issam: 280 };
const T_MOLAR_MASS_LABEL: Record<TMolarMass, string> = {
  pubchem: `${TESTOSTERONE_MOLAR_MASS.toFixed(1)} g/mol (PubChem)`,
  issam: '280 g/mol (issam.ch calculator)',
};

function resolveAlbumin(
  allResults: readonly ResultEntry[],
  resultsByDate: Record<string, Record<string, Result>>,
  date: string | undefined,
  biot: IndexDef | undefined,
  sameDraw: number | undefined,
  fallback: AlbuminFallback
): number | undefined {
  if (sameDraw != null) return sameDraw;
  if (fallback === 'default') return DEFAULT_ALBUMIN_GDL;
  if (fallback === 'nearest' && date && biot) {
    const nearest = nearestEntryTo(allResults, MARKER_CODES.ALB, date, { numericOnly: true });
    if (nearest) return markersForIndex(biot, resultsByDate[nearest.date] ?? {})['ALB'];
  }
  return undefined;
}

function snapshotOf(
  allResults: readonly ResultEntry[],
  resultsByDate: Record<string, Record<string, Result>>,
  date: string | undefined,
  unitSystem: UnitSystem,
  albuminFallback: AlbuminFallback,
  tMolarMass: TMolarMass
): Snapshot {
  const onDate = date ? allResults.filter((e) => e.date === date && e.result.value != null) : [];
  const resultsByLoinc = (date && resultsByDate[date]) || {};
  const nmolOf: Partial<Record<MeasureKey, number>> = {};

  const quantity = (key: MeasureKey, value: number, unit: string) => {
    if (DISPLAY_UNITS[key]?.molarMass === 'testosterone') nmolOf[key] = convertConcentration(value, unit, 'nmol/L', 'testosterone');
    const shown = inDisplayUnit(key, value, unit, unitSystem);
    return { text: `${fmtNum(shown.value)} ${shown.unit}`.trim(), unit: shown.unit, value: shown.value };
  };

  const marker = (key: MarkerKey): Measure => {
    const hit = onDate.find((e) => MARKER_CODES[key].includes(e.loinc));
    const own = hit && displayedResult(undefined, hit.result, unitSystem);
    if (!hit || own?.value == null) return EMPTY;
    const shown = quantity(key, own.value, own.unit);
    if (hasReference(hit.result)) {
      const lab = labRangeOf(key, hit.result, own.unit, unitSystem);
      return { text: shown.text, unit: shown.unit, lab, status: isOutOfRange(hit.result) ? 'bad' : 'ok' };
    }
    const curated = pathwayRangesFor(MARKER_CODES[key]);
    const status = curated ? rangeStatus(shown.value, rangesInUnit(curated, shown.unit)) : undefined;
    return { text: shown.text, unit: shown.unit, status: status ?? 'none' };
  };

  const biot = defOf('biot');
  const inputs = biot ? markersForIndex(biot, resultsByLoinc) : {};
  const albumin = resolveAlbumin(allResults, resultsByDate, date, biot, inputs['ALB'], albuminFallback);

  const pools =
    inputs['T'] != null && inputs['SHBG'] != null && albumin != null
      ? testosteronePools(inputs['T'], inputs['SHBG'], albumin, T_MOLAR_MASS_GPERMOL[tMolarMass])
      : undefined;

  const vermeulenNmol: Partial<Record<IndexKey, number>> = pools ? { cft: pools.free, biot: pools.free + pools.albuminBound } : {};

  const index = (key: IndexKey): Measure => {
    const def = defOf(key);
    if (!def) return EMPTY;
    if (key === 'cft' || key === 'biot') {
      const nmol = vermeulenNmol[key];
      if (nmol == null) return EMPTY;
      const value = convertConcentration(nmol, 'nmol/L', def.unit ?? '', 'testosterone');
      if (value == null) return EMPTY;
      return { text: quantity(key, value, def.unit ?? '').text, status: indexZone(def, value, MALE) ?? 'none' };
    }
    const value = computeIndex(def, resultsByLoinc);
    if (value == null) return EMPTY;
    return { text: quantity(key, value, def.unit ?? '').text, status: indexZone(def, value, MALE) ?? 'none' };
  };

  const pool = (key: MeasureKey, v: number | undefined): Measure => (v == null ? EMPTY : { text: quantity(key, v, 'nmol/L').text, status: 'none' });

  const markers = Object.fromEntries((Object.keys(MARKER_CODES) as MarkerKey[]).map((k) => [k, marker(k)]));
  const indices = Object.fromEntries(INDEX_KEYS.map((k) => [k, index(k)]));
  const snapshot: Snapshot = {
    ...(markers as Record<MarkerKey, Measure>),
    ...(indices as Record<IndexKey, Measure>),
    shbgBound: pool('shbgBound', pools?.shbgBound),
    albBound: pool('albBound', pools?.albuminBound),
  };
  const total = nmolOf.T;
  for (const key of SHARE_KEYS) {
    const part = nmolOf[key];
    if (snapshot[key] === EMPTY) continue;
    const percent = total && part != null ? (part / total) * 100 : undefined;
    snapshot[key] = { ...snapshot[key], share: percent == null ? DASH : formatShare(percent), sharePercent: percent };
  }
  return snapshot;
}

const SIGNAL_SIZE = SIZE.molecular;
/** A bound-T bubble is itself a molecular actor; the testosterone docked inside it is scaled to fit. */
const BUBBLE_SIZE = SIZE.molecular;
const DOCKED_SIZE = Math.round(BUBBLE_SIZE / 1.5);
/** CarrierIcon's drawing spans ~42.6 of its 48-unit viewBox, so its box is enlarged to bring the drawing itself to molecular-actor size. */
const CARRIER_SIZE = Math.round((SIZE.molecular * 48) / 42.6);

const RECEPTOR_ART: GlyphArt = { src: '/pathways/receptor-icon.png?v=2', width: 96, height: 96, box: [20, 23, 76, 74], size: SIZE.molecular };
const CELLS_ART: GlyphArt = { src: '/pathways/leydig-cells.png', width: 50, height: 50, box: [7, 6, 48, 46], size: SIZE.cell };
const BRAIN_ART: GlyphArt = { src: '/pathways/brain-pituitary.png?v=3', width: 256, height: 233, box: [5, 5, 251, 228], size: SIZE.organ };

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
  t: { label: 'T', title: 'Free Testosterone (calculated, Vermeulen)', measure: 'cft' },
  shbg: { label: 'SHBG', title: 'Sex Hormone-Binding Globulin', measure: 'SHBG' },
  alb: { label: 'Alb', title: 'Albumin', measure: 'ALB' },
  'shbg-t': {
    label: 'SHBG-T', title: 'SHBG-bound Testosterone', measure: 'shbgBound',
    note: 'Not bioavailable: held tightly by SHBG, released slowly.',
  },
  'alb-t': {
    label: 'Alb-T', title: 'Albumin-bound Testosterone', measure: 'albBound',
    note: 'Loosely bound, released quickly in tissue capillaries.',
  },
  e2: { label: 'E2', title: 'Estradiol', measure: 'E2' },
  e2blood: { label: 'E2', title: 'Estradiol', measure: 'E2' },
  dht: { label: 'DHT', title: 'Dihydrotestosterone', measure: 'DHT' },
};

const isCaptionId = (id: string | null): id is CaptionId => id != null && id in CAPTIONS;

const EFFECTS_PREFIX = 'effects-';
const effectsIdOf = (node: string) => EFFECTS_PREFIX + node;
const effectsNodeOf = (id: string | null): string | null => (id?.startsWith(EFFECTS_PREFIX) ? id.slice(EFFECTS_PREFIX.length) : null);

function indexReference(key: IndexKey, unitSystem: UnitSystem): ReferenceInfo {
  const def = defOf(key);
  if (!def) return NO_REFERENCE;
  return zoneReference(def, indexBands(def, MALE), (c) => inDisplayUnit(key, c, def.unit ?? '', unitSystem));
}

function curatedReference(key: MarkerKey, measure: Measure, unitSystem: UnitSystem): ReferenceInfo {
  const marker = pathwayRangesFor(MARKER_CODES[key]);
  if (!marker) return { headCites: [], lines: [], empty: 'No reference range', sources: [] };
  const catalogUnit = marker.loincs.map((l) => DEFAULT_UNITS[l]).find((u) => u && rangesInUnit(marker, u).every((r) => r.placed));
  const unit = measure.unit ?? DISPLAY_UNITS[key]?.[unitSystem] ?? catalogUnit;
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

function referenceOf(measureKey: MeasureKey, snapshot: Snapshot, unitSystem: UnitSystem): ReferenceInfo {
  const subject = subjectOf(measureKey);
  if (subject.kind === 'pool') return { headCites: [], lines: [], empty: 'No reference range (calculated pool)', sources: [] };
  if (subject.kind === 'index') return indexReference(subject.key, unitSystem);
  const measure = snapshot[subject.key];
  if (measure.lab) return labReference(measure.lab);
  return curatedReference(subject.key, measure, unitSystem);
}

interface PathwayState {
  open: string | null;
  snapshot: Snapshot;
  toggleCaption: (id: string, chip: HTMLElement) => void;
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
      <span className="mc-pathway-node-value"><ChipValue measure={measure} /></span>
    </button>
  );
}

function CaptionCard({ id, left, top, snapshot, date, unitSystem }: Readonly<{ id: CaptionId; left: number; top: number; snapshot: Snapshot; date: string | undefined; unitSystem: UnitSystem }>) {
  const spec = CAPTIONS[id];
  const measure = snapshot[spec.measure];
  const info = referenceOf(spec.measure, snapshot, unitSystem);
  const scope = `pathway-${id}`;
  return (
    <dialog open className="mc-pathway-pop" aria-label={spec.title} style={{ left, top, width: CARD_WIDTH, margin: 0 }}>
      <div className="mc-pathway-pop-title">{spec.title}</div>
      <div className="mc-pathway-pop-facts">
        <span><b>Value</b> {valueText(measure)}</span>
        <span><b>Date</b> {date ? formatFullDate(date) : DASH}</span>
      </div>
      {spec.note && <p className="mc-pathway-pop-note">{spec.note}</p>}
      <ReferenceBlock scope={scope} info={info} />
      <SourcesBlock scope={scope} info={info} />
    </dialog>
  );
}

function EffectsCard({ node, left, top }: Readonly<{ node: string; left: number; top: number }>) {
  const receptor = receptorById(node);
  if (!receptor) return null;
  const { effects, sources } = numberedEffects(receptor);
  const scope = `pathway-${effectsIdOf(node)}`;
  return (
    <dialog open className="mc-pathway-pop" aria-label={`${receptor.name}: effects`} style={{ left, top, width: CARD_WIDTH, margin: 0 }}>
      <div className="mc-pathway-pop-title">{receptor.name}</div>
      <div className="mc-pathway-pop-facts">
        <span><b>Activated by</b> {receptor.ligands.join(', ')}</span>
      </div>
      <div className="mc-pathway-ref">
        <div className="mc-pathway-ref-head"><b>Effects in adult men</b></div>
        <ul className="mc-pathway-effects">
          {effects.map((e) => (
            <li key={e.id}>
              {e.text}
              <Cites scope={scope} cites={e.cites} />
            </li>
          ))}
        </ul>
      </div>
      <SourcesBlock scope={scope} info={{ headCites: [], lines: [], sources }} />
    </dialog>
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
      <span className="mc-pathway-bubble" style={{ width: BUBBLE_SIZE, height: BUBBLE_SIZE }}>
        <HormoneIcon size={DOCKED_SIZE} />
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
      <HormoneIcon size={SIGNAL_SIZE} />
      <Caption id={id} />
    </div>
  );
}

function Cells({ label, node }: Readonly<{ label: string; node: string }>) {
  return (
    <div className="mc-pathway-anchor mc-pathway-node mc-pathway-slot" data-node={node}>
      <Glyph art={CELLS_ART} />
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{label}</span>
      </div>
    </div>
  );
}

function HpDiagram() {
  return (
    <div className="mc-pathway-row mc-pathway-row-start">
      <div className="mc-pathway-hp">
        <div className="mc-pathway-anchor mc-pathway-node" data-node="pituitary">
          <Glyph art={BRAIN_ART} alt="Hypothalamus and pituitary" />
          <div className="mc-pathway-caption">
            <span className="mc-pathway-node-label">Hypothalamus + Pituitary</span>
          </div>
        </div>
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

function Enzyme({
  label,
  node,
  art,
  children,
}: Readonly<{ label: string; node: string; art: GlyphArt; children?: ReactNode }>) {
  const particle: Particle1 = { name: label, type: 'enzyme' };
  return (
    <Particle1Node particle={particle} art={art} dataNode={node}>
      {children}
    </Particle1Node>
  );
}

function Receptor({ label, node }: Readonly<{ label: string; node: string }>) {
  const state = useContext(PathwayContext);
  const id = effectsIdOf(node);
  const expanded = state?.open === id;
  return (
    <div className="mc-pathway-anchor mc-pathway-node" data-node={node}>
      <Glyph art={RECEPTOR_ART} />
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{label}</span>
        {state && receptorById(node) && (
          <button
            type="button"
            className={expanded ? 'mc-pathway-chip mc-pathway-effects-toggle mc-pathway-chip-open' : 'mc-pathway-chip mc-pathway-effects-toggle'}
            data-effects={id}
            aria-expanded={expanded}
            aria-label={`${label}: effects`}
            onClick={(e) => state.toggleCaption(id, e.currentTarget)}
          >
            Effects {expanded ? '▾' : '▸'}
          </button>
        )}
      </div>
    </div>
  );
}

function TargetDiagram() {
  return (
    <div className="mc-pathway-row mc-pathway-row-start">
      <div className="mc-pathway-enzymes">
        <Enzyme label="5α-reductase" node="srd5a" art={ENZYME_ART}>
          <Hormone id="dht" />
        </Enzyme>
        <Enzyme label="aromatase" node="aromatase" art={ENZYME_ART}>
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

const DONUT = { size: 80, radius: 34, width: 12, minFreeSweep: 4 } as const;
const CALLOUT = { lineGap: 12, labelGap: 27, minY: -12, maxY: 92 } as const;

const POOL_SLICES = [
  { measure: 'shbgBound', name: 'SHBG-T', callout: 'SHBG-T', title: 'SHBG-bound testosterone', color: 'var(--pathway-pool-shbg)' },
  { measure: 'albBound', name: 'Albumin-T', callout: 'Albumin-T', title: 'Albumin-bound testosterone', color: 'var(--pathway-pool-albumin)' },
  { measure: 'cft', name: 'Free T', callout: 'Free', title: 'Free testosterone (Vermeulen)', color: 'var(--pathway-pool-free)' },
] as const satisfies readonly { measure: MeasureKey; name: string; callout: string; title: string; color: string }[];

type Callout = { index: number; x0: number; y0: number; x1: number; y1: number; right: boolean; y: number };

/** Label heights on one side of the ring, pushed apart so no two overlap and kept within the chart's vertical room. */
function spreadLabels(side: Callout[]): void {
  side.sort((a, b) => a.y - b.y);
  for (let i = 1; i < side.length; i++) side[i].y = Math.max(side[i].y, side[i - 1].y + CALLOUT.labelGap);
  const last = side.length - 1;
  if (last >= 0 && side[last].y > CALLOUT.maxY) {
    side[last].y = CALLOUT.maxY;
    for (let i = last - 1; i >= 0; i--) side[i].y = Math.min(side[i].y, side[i + 1].y - CALLOUT.labelGap);
  }
}

function poolCallouts(sweeps: readonly number[]): Callout[] {
  const callouts: Callout[] = [];
  let start = 0;
  sweeps.forEach((sweep, index) => {
    const mid = start + sweep / 2;
    start += sweep;
    if (sweep <= 0) return;
    const [x0, y0] = polar(mid, DONUT.radius + DONUT.width / 2 + 1);
    const [x1, y1] = polar(mid, DONUT.radius + DONUT.width / 2 + 9);
    const right = mid % 360 < 180;
    callouts.push({ index, x0, y0, x1, y1, right, y: clamp(y1, CALLOUT.minY, CALLOUT.maxY) });
  });
  spreadLabels(callouts.filter((c) => c.right));
  spreadLabels(callouts.filter((c) => !c.right));
  return callouts;
}

function polar(angle: number, r: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  const c = DONUT.size / 2;
  return [c + r * Math.sin(rad), c - r * Math.cos(rad)];
}

function arcPath(from: number, to: number): string {
  const [x0, y0] = polar(from, DONUT.radius);
  const [x1, y1] = polar(to, DONUT.radius);
  return `M${x0},${y0} A${DONUT.radius},${DONUT.radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x1},${y1}`;
}

/** Sweeps in degrees, the free sliver widened to a visible minimum at the expense of the largest bound pool. */
function poolSweeps(percents: readonly number[]): number[] {
  const sum = percents.reduce((a, b) => a + b, 0);
  const sweeps = percents.map((p) => (p / sum) * 360);
  const deficit = DONUT.minFreeSweep - sweeps[2];
  if (deficit > 0) {
    const largest = sweeps[0] >= sweeps[1] ? 0 : 1;
    sweeps[largest] -= deficit;
    sweeps[2] = DONUT.minFreeSweep;
  }
  return sweeps;
}

function PoolsDonut({ snapshot }: Readonly<{ snapshot: Snapshot }>) {
  const measures = POOL_SLICES.map((s) => snapshot[s.measure]);
  const percents = measures.map((m) => m.sharePercent);
  const ready = percents.every((p): p is number => p != null && Number.isFinite(p) && p >= 0) && percents.some((p) => (p ?? 0) > 0);
  const shares = measures.map((m) => (ready ? (m.share ?? DASH) : DASH));
  const poolShareLabels = POOL_SLICES.map((s, i) => `${s.name} ${shares[i]}`);
  const label = ready ? `Testosterone pools: ${poolShareLabels.join(', ')}` : 'Testosterone pools: no data';

  let arcs: ReactNode = <circle cx={DONUT.size / 2} cy={DONUT.size / 2} r={DONUT.radius} fill="none" stroke="var(--pathway-pool-empty)" strokeWidth={DONUT.width} />;
  let callout: ReactNode = null;
  if (ready) {
    const sweeps = poolSweeps(percents as number[]);
    let start = 0;
    arcs = POOL_SLICES.map((s, i) => {
      const from = start;
      start += sweeps[i];
      if (sweeps[i] <= 0) return null;
      const title = <title>{`${s.title}: ${shares[i]}`}</title>;
      return sweeps[i] >= 359.99 ? (
        <circle key={s.measure} cx={DONUT.size / 2} cy={DONUT.size / 2} r={DONUT.radius} fill="none" stroke={s.color} strokeWidth={DONUT.width}>{title}</circle>
      ) : (
        <path key={s.measure} d={arcPath(from, start)} fill="none" stroke={s.color} strokeWidth={DONUT.width}>{title}</path>
      );
    });
    callout = (
      <g className="mc-pathway-pools-callout" aria-hidden="true">
        {poolCallouts(sweeps).map((c) => {
          const edge = c.right ? Math.max(c.x1, DONUT.size + 2) : Math.min(c.x1, -2);
          const tx = c.right ? edge + 3 : edge - 3;
          return (
            <g key={POOL_SLICES[c.index].measure}>
              <polyline points={`${c.x0},${c.y0} ${c.x1},${c.y1} ${edge},${c.y}`} fill="none" stroke="currentColor" strokeWidth={1} />
              <text textAnchor={c.right ? 'start' : 'end'}>
                <tspan x={tx} y={c.y - CALLOUT.lineGap / 2} dominantBaseline="central">{POOL_SLICES[c.index].callout}</tspan>
                <tspan x={tx} y={c.y + CALLOUT.lineGap / 2} dominantBaseline="central">{shares[c.index]}</tspan>
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <div className="mc-pathway-pools">
      <div className="mc-pathway-pools-caption">Testosterone pools</div>
      <div className="mc-pathway-pools-chart">
        <svg className="mc-pathway-pools-donut" width={DONUT.size} height={DONUT.size} viewBox={`0 0 ${DONUT.size} ${DONUT.size}`} role="img" aria-label={label}>
          {arcs}
          {callout}
        </svg>
      </div>
      <div className="mc-pathway-pools-legend" aria-hidden="true">
        {!ready && <div className="mc-pathway-pools-empty">{DASH}</div>}
        <div className="mc-pathway-pools-note">Bio-T = Albumin-T + Free T</div>
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

type PathwayShape = 'straight' | 'elbow' | 'drop' | 'fork';

const PATHWAYS: ReadonlyArray<readonly [string, string, PathwayShape]> = [
  ['pituitary', 'fsh', 'fork'],
  ['pituitary', 'lh', 'fork'],
  ['lh', 'leydig', 'straight'],
  ['fsh', 'sertoli', 'straight'],
  ['leydig', 't', 'elbow'],
  ['aromatase', 'e2', 'straight'],
  ['srd5a', 'dht', 'straight'],
  ['e2', 'e2blood', 'elbow'],
  ['e2blood', 'er', 'drop'],
];

/** The one badge merging measured free T with both calculated estimates. */
const FREE_T_BADGE = 'free-t';

const ASSOCIATIONS: Readonly<Record<string, readonly string[]>> = {
  'total-t': ['shbg-t', 't', 'alb-t'],
  [FREE_T_BADGE]: ['t'],
  'bio-t': ['t', 'alb-t'],
  tlh: ['leydig'],
  dhtt: ['srd5a'],
  't-e2': ['aromatase'],
};

type CenterX = (rect: DOMRect) => number;

/** A DOM mutation, not a line to draw. */
function positionEnzymes(el: HTMLDivElement, base: DOMRect, centerX: CenterX, zoom: number): void {
  const tNode = el.querySelector('[data-node="t"]');
  const enzymes = el.querySelector<HTMLElement>('.mc-pathway-enzymes');
  if (!tNode || !enzymes) return;
  enzymes.style.transform = '';
  const imgs = [...enzymes.querySelectorAll('.mc-pathway-enzyme .mc-pathway-glyph')].map((i) => i.getBoundingClientRect());
  if (imgs.length !== 2) return;
  const mid = (centerX(imgs[0]) + centerX(imgs[1])) / 2;
  const containerLeft = enzymes.getBoundingClientRect().left - base.left;
  const ar = enzymes.querySelector<HTMLElement>('.mc-pathway-ar');
  if (ar) ar.style.left = `${(mid - containerLeft - ar.getBoundingClientRect().width / 2) / zoom}px`;
  enzymes.style.transform = `translateX(${(centerX(tNode.getBoundingClientRect()) + 8 - mid) / zoom}px)`;
  const er = enzymes.querySelector<HTMLElement>('.mc-pathway-er');
  const e2 = el.querySelector('[data-node="e2"]');
  const e2blood = el.querySelector('[data-node="e2blood"]');
  if (!er || !e2 || !e2blood) return;
  const box = enzymes.getBoundingClientRect();
  const e2Rect = e2.getBoundingClientRect();
  er.style.left = `${(centerX(e2blood.getBoundingClientRect()) + base.left - box.left) / zoom + 48}px`;
  er.style.top = `${(e2Rect.top + e2Rect.height / 2 - box.top - er.getBoundingClientRect().height / 2) / zoom}px`;
}

function positionPituitary(el: HTMLDivElement, centerX: CenterX, zoom: number): void {
  const hp = el.querySelector<HTMLElement>('.mc-pathway-hp');
  const icon = hp?.querySelector('[data-node="pituitary"] .mc-pathway-glyph');
  const tNode = el.querySelector('[data-node="t"]');
  if (!hp || !icon || !tNode) return;
  hp.style.transform = '';
  const axis = centerX(tNode.getBoundingClientRect()) + 8;
  hp.style.transform = `translateX(${(axis - centerX(icon.getBoundingClientRect())) / zoom}px)`;
}

const bandsZoom = (bands: HTMLElement): number => Number(bands.style.getPropertyValue('zoom')) || 1;

/** The natural extent is measured unzoomed-equivalent, so the zoom does not feed back into itself. */
function fitBands(el: HTMLDivElement, base: DOMRect, centerX: CenterX): void {
  const main = el.querySelector<HTMLElement>('.mc-pathway-main');
  const bands = el.querySelector<HTMLElement>('.mc-pathway-bands');
  if (!main || !bands) return;
  const zoom = bandsZoom(bands);
  positionPituitary(el, centerX, zoom);
  positionEnzymes(el, base, centerX, zoom);
  const left = bands.getBoundingClientRect().left;
  const parts = bands.querySelectorAll('[data-node], .mc-pathway-caption, .mc-pathway-node-label');
  const right = Math.max(left, ...[...parts].map((n) => n.getBoundingClientRect().right));
  const natural = (right - left) / zoom + 8;
  const next = Math.min(1, main.getBoundingClientRect().width / natural);
  if (Math.abs(next - zoom) < 0.002) return;
  if (next === 1) bands.style.removeProperty('zoom');
  else bands.style.setProperty('zoom', next.toFixed(4));
  positionPituitary(el, centerX, bandsZoom(bands));
  positionEnzymes(el, base, centerX, bandsZoom(bands));
}

/** A trunk line from T down to the androgen receptors, with a spur to DHT when it has a reading. */
function buildExtraLines(el: HTMLDivElement, base: DOMRect, centerX: CenterX): string[] {
  const trunkNode = el.querySelector('[data-node="t"]');
  const arNode = el.querySelector('[data-node="ar"]');
  const dhtNode = el.querySelector('[data-node="dht"]');
  if (!trunkNode || !arNode) return [];
  const x = centerX(trunkNode.getBoundingClientRect()) + 8;
  const arRect = arNode.getBoundingClientRect();
  const firstEnzyme = el.querySelector('[data-node="srd5a"] .mc-pathway-glyph');
  const junction = (firstEnzyme?.getBoundingClientRect().top ?? arRect.top) - base.top - 28;
  const extra = [
    `trunk:${x},${junction} ${x},${arRect.top - base.top - 4}`,
    `${x},${arRect.top - base.top - 12} ${x},${arRect.top - base.top - 4}`,
  ];
  if (!dhtNode) return extra;
  const d = dhtNode.getBoundingClientRect();
  const dBottom = (dhtNode.querySelector('.mc-pathway-caption') ?? dhtNode).getBoundingClientRect().bottom - base.top + 5;
  const midY = arRect.top + arRect.height / 2 - base.top;
  const fromLeft = centerX(d) < centerX(arRect);
  const arEdge = fromLeft ? arRect.left - base.left - 4 : arRect.right - base.left + 4;
  extra.push(`${centerX(d)},${dBottom} ${centerX(d)},${midY} ${arEdge},${midY}`);
  return extra;
}

/** A single fork's trunk-plus-branches line set, from one node down to several target icons. */
function forkLines(el: HTMLDivElement, base: DOMRect, centerX: CenterX, from: string, targets: readonly string[]): string[] {
  const a = el.querySelector(`[data-node="${from}"]`);
  const icons = targets.map((t) => el.querySelector(`[data-node="${t}"] .mc-pathway-glyph`)).filter((n): n is Element => n !== null);
  if (!a || icons.length === 0) return [];
  const x = centerX(a.getBoundingClientRect()) + 8;
  const y1 = (a.querySelector('.mc-pathway-caption') ?? a).getBoundingClientRect().bottom - base.top + 5;
  const rects = icons.map((i) => i.getBoundingClientRect());
  const junction = Math.min(...rects.map((r) => r.top)) - base.top - 28;
  return [
    `trunk:${x},${y1} ${x},${junction}`,
    ...rects.map((r) => `${x},${junction - 12} ${x},${junction} ${centerX(r)},${junction} ${centerX(r)},${r.top - base.top - 4}`),
  ];
}

/** The 'elbow' shape's line: a horizontal run at the source's mid-height, then down to the target. */
function elbowPathwayLine(a: Element, ra: DOMRect, base: DOMRect, centerX: CenterX, x2: number, y2: number): string[] {
  const midY = ra.top + ra.height / 2 - base.top;
  const inset = a.classList.contains('mc-pathway-slot') ? 18 : -4;
  const x1 = x2 >= centerX(ra) ? ra.right - base.left - inset : ra.left - base.left + inset;
  return [`${x1},${midY} ${x2},${midY} ${x2},${y2}`];
}

/** The 'fork' shape's line: branches off the source's own icon rather than its caption baseline. */
function forkPathwayLine(a: Element, base: DOMRect, centerX: CenterX, x2: number, y2: number): string[] {
  const glyph = (a.querySelector('.mc-pathway-glyph, svg') ?? a).getBoundingClientRect();
  const midY = glyph.top + glyph.height / 2 - base.top;
  const x1 = x2 < centerX(glyph) ? glyph.left - base.left - 4 : glyph.right - base.left + 4;
  return [`${x1},${midY} ${x2},${midY} ${x2},${y2}`];
}

/** The 'drop' shape's line: down from the source, then sideways into the target's mid-height. */
function dropPathwayLine(ra: DOMRect, rb: DOMRect, base: DOMRect, centerX: CenterX, bottomOfA: number): string[] {
  const x = centerX(ra) + 8;
  const midY = rb.top + rb.height / 2 - base.top;
  const edge = x < centerX(rb) ? rb.left - base.left - 4 : rb.right - base.left + 4;
  return [`${x},${bottomOfA} ${x},${midY} ${edge},${midY}`];
}

/** One pathway edge's line, shaped for the geometry the two nodes need. */
function pathwayLine(
  el: HTMLDivElement,
  base: DOMRect,
  centerX: CenterX,
  from: string,
  to: string,
  shape: PathwayShape
): string[] {
  const a = el.querySelector(`[data-node="${from}"]`);
  const b = el.querySelector(`[data-node="${to}"]`);
  if (!a || !b) return [];
  const ra = (a.classList.contains('mc-pathway-enzyme') ? (a.querySelector('.mc-pathway-glyph') ?? a) : a).getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  const bottomOf = (node: Element) => (node.querySelector('.mc-pathway-caption') ?? node).getBoundingClientRect().bottom - base.top + 5;
  const down = rb.top >= ra.top;
  const x2 = centerX(rb) - (shape === 'elbow' ? 8 : 0);
  const y2 = down ? rb.top - base.top - 4 : bottomOf(b);
  if (shape === 'elbow') return elbowPathwayLine(a, ra, base, centerX, x2, y2);
  if (shape === 'fork') return forkPathwayLine(a, base, centerX, x2, y2);
  if (shape === 'drop') return dropPathwayLine(ra, rb, base, centerX, bottomOf(a));
  return [`${centerX(ra)},${down ? bottomOf(a) : ra.top - base.top - 4} ${x2},${y2}`];
}

interface FeedbackMark {
  x: number;
  y: number;
}

/** Estradiol's negative feedback: up from blood E2, then left at the brain's mid-height to its right side, marked "↓" at the head. */
function feedbackLine(el: HTMLDivElement, base: DOMRect, centerX: CenterX): { lines: string[]; marks: FeedbackMark[] } {
  const e2 = el.querySelector('[data-node="e2blood"] svg');
  const brain = el.querySelector('[data-node="pituitary"] .mc-pathway-glyph');
  if (!e2 || !brain) return { lines: [], marks: [] };
  const from = e2.getBoundingClientRect();
  const to = brain.getBoundingClientRect();
  const lane = to.top + to.height / 2 - base.top;
  const tip = to.right - base.left + 4;
  return {
    lines: [`${centerX(from)},${from.top - base.top - 4} ${centerX(from)},${lane} ${tip},${lane}`],
    marks: [{ x: tip + 10, y: lane - 5 }],
  };
}

function buildPathwayLines(el: HTMLDivElement, base: DOMRect, centerX: CenterX): string[] {
  return PATHWAYS.flatMap(([from, to, shape]) => pathwayLine(el, base, centerX, from, to, shape));
}

function buildAssociations(el: HTMLDivElement, base: DOMRect): Association[] {
  return Object.entries(ASSOCIATIONS).flatMap(([badge, targets]) => associationFor(el, base, badge, targets));
}

function PathwayArrows({ root, active, focused, layoutKey }: Readonly<{ root: RefObject<HTMLDivElement | null>; active: string | null; focused: string | null; layoutKey: string }>) {
  const [lines, setLines] = useState<string[]>([]);
  const [marks, setMarks] = useState<FeedbackMark[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [veil, setVeil] = useState<{ w: number; h: number } | null>(null);

  const measure = (el: HTMLDivElement) => {
    const base = el.getBoundingClientRect();
    const centerX: CenterX = (r) => r.left + r.width / 2 - base.left;
    fitBands(el, base, centerX);
    const bandsBox = el.querySelector('.mc-pathway-bands')?.getBoundingClientRect();
    if (bandsBox) setVeil({ w: bandsBox.right - base.left, h: bandsBox.bottom - base.top });
    setAssociations(buildAssociations(el, base));
    const feedback = feedbackLine(el, base, centerX);
    setMarks(feedback.marks);
    setLines([
      ...buildExtraLines(el, base, centerX),
      ...forkLines(el, base, centerX, 't', ['aromatase', 'srd5a']),
      ...buildPathwayLines(el, base, centerX),
      ...feedback.lines,
    ]);
  };
  useMeasuredLayout(root, layoutKey, measure);

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
      {marks.map((m) => (
        <text key={`${m.x},${m.y}`} className="mc-pathway-feedback" x={m.x} y={m.y} textAnchor="middle">
          ↓
        </text>
      ))}
      <AssociationLayer associations={associations} active={active} focused={focused} veil={veil} />
    </svg>
  );
}

interface Badge {
  id: string;
  name: string;
  /** Absent only when `unavailable` is set — a badge for a formula this app does not compute. */
  measure?: MeasureKey;
  meaning: string;
  low: string;
  high: string;
  caveats: string;
  /** Render a fixed placeholder instead of looking up `measure`. */
  unavailable?: boolean;
}

const BADGES: ReadonlyArray<Badge> = [
  {
    id: 'total-t', name: 'Total Testosterone', measure: 'T',
    meaning: 'The overall androgen output your body is producing, before protein binding decides how much of it is actually active.',
    low: 'Less testosterone made, or less SHBG holding it.',
    high: 'More made, or more SHBG holding it (free T may still be normal).',
    caveats: 'Peaks in the morning; SHBG changes it without changing free T.',
  },
  {
    id: 'bio-t', name: 'Bioavailable Testosterone', measure: 'biot',
    meaning: 'The androgen pool tissues can actually draw on — free plus the share loosely held by albumin, as opposed to what sits inertly locked to SHBG.',
    low: 'Less testosterone reaching tissues.',
    high: 'More reaching tissues.',
    caveats: 'Calculated; reference bands depend on sex and age.',
  },
  {
    id: FREE_T_BADGE, name: 'Free Testosterone', measure: 'cft',
    meaning: 'The unbound share (about 1–3% of total) that can actually enter cells — the androgen signal tissues have available to use. The lab may measure it directly by immunoassay, or it is calculated from total T and SHBG: by Vermeulen’s binding equation (with albumin), or by Ly & Handelsman’s purely empirical regression (no albumin term).',
    low: 'Less testosterone available to tissues.',
    high: 'More available to tissues.',
    caveats: 'Direct free-T immunoassays are lab-specific, systematically under-read and unreliable, so two assays can disagree several-fold with each other and with the calculated value, which is preferred. Against equilibrium dialysis Vermeulen’s equation runs a constant ~19% high in men (33% in women), unrelated to the patient’s own SHBG, T or albumin. Ly & Handelsman’s is an empirical regression, not a physical binding model, so it carries no mechanistic interpretation and can extrapolate to a negative, non-physiological value outside the data it was fit on (shown as “–”, never as a number); in one independent comparison against equilibrium dialysis it ran closer than Vermeulen’s equation (median ratio 1.00 vs 1.19).',
  },
  {
    id: 'tlh', name: 'T/LH', measure: 'tlh',
    meaning: 'A functional readout of Leydig-cell activity — how well the testes respond to pituitary LH drive.',
    low: 'The testes respond poorly (primary or compensated hypogonadism).',
    high: 'A strong testicular response.',
    caveats: 'LH is pulsatile, so one sample is noisy; no agreed reference range.',
  },
  {
    id: 'dhtt', name: 'DHT/T', measure: 'dhtt',
    meaning: 'How much testosterone is being converted to the more potent DHT — the androgen signal driving skin, scalp and prostate tissue.',
    low: 'Less conversion (e.g. finasteride, dutasteride).',
    high: 'More conversion.',
    caveats: 'Serum DHT understates tissue DHT; LC-MS/MS assays are more reliable.',
  },
  {
    id: 't-e2', name: 'T/E2', measure: 'te2',
    meaning: 'Aromatase enzyme activity (often due to excess body fat).',
    low: 'Excess estrogen conversion.',
    high: 'Too little estradiol for bone, libido and mood.',
    caveats: 'E2 immunoassays are unreliable at male levels; units matter.',
  },
];

/** A badge's reference info while its card is expanded — null while collapsed, since there is nothing to render. */
function badgeReferenceInfo(expanded: boolean, measure: Measure | undefined, b: Badge, snapshot: Snapshot, unitSystem: UnitSystem): ReferenceInfo | null {
  if (!expanded) return null;
  if (!measure) return NO_REFERENCE;
  return referenceOf(b.measure!, snapshot, unitSystem);
}

/** The Free Testosterone badge cites only these, in this order, matched by title; INDEX_DEFS keeps the full list. */
const FREE_T_SOURCE_TITLES: readonly string[] = [
  'Testosterone Therapy in Men With Hypogonadism',
  'A critical evaluation of simple methods for the estimation of free testosterone',
  'Empirical estimation of free testosterone',
];

const FREE_T_PCT_RANGE = '1.5–3.2 %';

/** Labcorp 500726's adult male % free interval, cited as INDEX_DEFS' percentage indices cite it. */
const FREE_T_PCT_SOURCE: CitedSource | undefined = (() => {
  const r = defOf('ftpct')?.references.find((ref) => ref.url?.includes('labcorp.com/tests/500726'));
  return r && { organization: r.organization, title: r.document, url: r.url, year: r.year, retrieved: r.retrieved };
})();

const CALCULATED_FREE_T: ReadonlyArray<readonly [IndexKey, string]> = [
  ['cft', 'Vermeulen'],
  ['cftlh', 'Ly & Handelsman'],
];

function FreeTestosteroneBody({ badge, snapshot, unitSystem }: Readonly<{ badge: Badge; snapshot: Snapshot; unitSystem: UnitSystem }>) {
  const scope = `pathway-${badge.id}`;
  const merged = mergeReferences([referenceOf('FT', snapshot, unitSystem), ...CALCULATED_FREE_T.map(([key]) => indexReference(key, unitSystem))]);
  const kept = keepSources(merged.infos, merged.sources, FREE_T_SOURCE_TITLES);
  const { infos } = kept;
  const sources = FREE_T_PCT_SOURCE ? [...kept.sources, FREE_T_PCT_SOURCE] : kept.sources;
  const pctRef: ReferenceInfo = {
    tag: defOf('ftpct')?.evidenceLevel,
    headCites: FREE_T_PCT_SOURCE ? [sources.length] : [],
    lines: [{ text: FREE_T_PCT_RANGE, cites: [] }],
    sources: [],
  };
  const pctLine = <ReferenceBlock scope={scope} info={pctRef} title="Ref range (%)" />;
  const [measured, ...calculated] = infos;
  const calculatedRef = combinedZones(calculated, CALCULATED_FREE_T.map(([, method]) => method));
  return (
    <div className="mc-pathway-badge-body">
      <div className="mc-pathway-badge-section">
        <b>Measured</b>
        <div className="mc-pathway-ref-line">
          <span className="mc-pathway-ref-label">Measured</span>
          <span className="mc-pathway-ref-value">{valueText(snapshot.FT)}</span>
        </div>
        <ReferenceBlock scope={scope} info={measured} title="Ref range" />
      </div>
      <div className="mc-pathway-badge-section">
        <b>Calculated</b>
        {CALCULATED_FREE_T.map(([key, method]) => (
          <div key={key} className="mc-pathway-ref-line">
            <span className="mc-pathway-ref-label">cFT {method}</span>
            <span className="mc-pathway-ref-value">{valueText(snapshot[key])}</span>
          </div>
        ))}
        <ReferenceBlock scope={scope} info={calculatedRef} title="Ref ranges" />
        {pctLine}
        <div className="mc-pathway-ref-empty">measured by equilibrium dialysis; calculated values are compared against it</div>
      </div>
      <span><b>Meaning</b> {badge.meaning}</span>
      <span><b>Low</b> {badge.low}</span>
      <span><b>High</b> {badge.high}</span>
      <span><b>Caveats</b> {badge.caveats}</span>
      <SourcesBlock scope={scope} info={{ headCites: [], lines: [], sources }} />
    </div>
  );
}

function Badges({
  snapshot,
  unitSystem,
  open,
  setOpen,
  setHovered,
}: Readonly<{ snapshot: Snapshot; unitSystem: UnitSystem; open: string | null; setOpen: (id: string | null) => void; setHovered: (id: string | null) => void }>) {
  return (
    <aside className="mc-pathway-badges" aria-label="Measures and ratios">
      <PoolsDonut snapshot={snapshot} />
      {BADGES.map((b) => {
        const expanded = open === b.id;
        const scope = `pathway-${b.id}`;
        const measure = b.unavailable || !b.measure ? undefined : snapshot[b.measure];
        const status = measure?.status ?? 'none';
        const value = measure ? valueText(measure) : 'Not available';
        const info = b.id === FREE_T_BADGE ? null : badgeReferenceInfo(expanded, measure, b, snapshot, unitSystem);
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
                <span className={`mc-pathway-dot mc-pathway-dot-${status}`} />
              </span>
              <span className="mc-pathway-badge-value">{value}</span>
            </button>
            {expanded && b.id === FREE_T_BADGE && <FreeTestosteroneBody badge={b} snapshot={snapshot} unitSystem={unitSystem} />}
            {expanded && info && (
              <div className="mc-pathway-badge-body">
                <ReferenceBlock scope={scope} info={info} />
                <span><b>Meaning</b> {b.meaning}</span>
                <span><b>Low</b> {b.low}</span>
                <span><b>High</b> {b.high}</span>
                <span><b>Caveats</b> {b.caveats}</span>
                <SourcesBlock scope={scope} info={info} />
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

export function HormonalPathwaysView({
  allResults,
  resultsByDate,
  panelTests,
  unitSystem,
  onUnitSystemChange,
}: Readonly<{
  allResults: readonly ResultEntry[];
  resultsByDate: Record<string, Record<string, Result>>;
  /** The Hypogonadism panel's observations, whose results-table dates the stepper lists. */
  panelTests: readonly Observation[];
  unitSystem: UnitSystem;
  onUnitSystemChange: (unitSystem: UnitSystem) => void;
}>) {
  const bandsRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [cardAt, setCardAt] = useState<{ left: number; top: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [albuminFallback, setAlbuminFallback] = useState<AlbuminFallback>('default');
  const [tMolarMass, setTMolarMass] = useState<TMolarMass>('pubchem');
  const dates = useMemo(() => panelDates(PANEL_NAME, panelTests, allResults).reverse(), [panelTests, allResults]);
  const date = picked && dates.includes(picked) ? picked : dates.at(-1);
  const snapshot = useMemo(
    () => snapshotOf(allResults, resultsByDate, date, unitSystem, albuminFallback, tMolarMass),
    [allResults, resultsByDate, date, unitSystem, albuminFallback, tMolarMass]
  );

  const placeCard = useCallback((chip: Element) => {
    const layout = bandsRef.current;
    if (!layout) return null;
    const a = chip.getBoundingClientRect();
    const box = layout.getBoundingClientRect();
    const left = clamp(a.left + a.width / 2 - box.left - CARD_WIDTH / 2, 0, Math.max(box.width - CARD_WIDTH, 0));
    return { left, top: a.bottom - box.top + 6 };
  }, []);

  const toggleCaption = useCallback(
    (id: string, chip: HTMLElement) => {
      if (open === id) {
        setOpen(null);
        return;
      }
      setCardAt(placeCard(chip));
      setOpen(id);
    },
    [open, placeCard]
  );

  const close = useCallback(() => setOpen(null), []);
  const replaceCard = useCallback(() => {
    const chip = bandsRef.current?.querySelector(`[data-caption="${open}"], [data-effects="${open}"]`);
    if (chip) setCardAt(placeCard(chip));
  }, [open, placeCard]);
  useDismiss(open, close, '.mc-pathway-pop, [data-caption], [data-badge], [data-effects]', replaceCard);

  const effectsNode = effectsNodeOf(open);
  const badgeOpen = isCaptionId(open) || effectsNode ? null : open;
  const state = useMemo<PathwayState>(() => ({ open, snapshot, toggleCaption }), [open, snapshot, toggleCaption]);
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
        <div className="mc-pathway-check">
          <span aria-hidden="true">Unit system</span>
          <SegmentedControl
            label="Unit system"
            options={['si', 'us'] as const}
            value={unitSystem}
            onChange={onUnitSystemChange}
            format={(sys) => sys.toUpperCase()}
          />
        </div>
      </div>
      <ArtworkNote>The brain and cell images are illustrative.</ArtworkNote>
      <PathwayContext.Provider value={state}>
      <div className="mc-pathway-layout" ref={bandsRef}>
      <PathwayArrows root={bandsRef} active={hovered ?? badgeOpen} focused={badgeOpen} layoutKey={`${date ?? ''}|${unitSystem}|${albuminFallback}|${tMolarMass}`} />
      <div className="mc-pathway-main">
        <div className="mc-pathway-bands">
          {SITES.map(({ id, title, description }) => (
            <section key={id} className="mc-pathway-band" aria-label={title}>
              <div className="mc-pathway-site">
                <h2 className="mc-pathway-title" title={description}>{title}</h2>
              </div>
              <div className="mc-pathway-diagram">
                {id === 'hp' && <HpDiagram />}
                {id === 'cardio' && <CardioDiagram />}
                {id === 'testes' && <TestesDiagram />}
                {id === 'target' && <TargetDiagram />}
              </div>
            </section>
          ))}
        </div>
        <div className="mc-pathway-settings">
          <label className="mc-pathway-check">
            <span>Albumin when not measured this draw</span>
            <select
              className="mc-field mc-field-select mc-field-sm"
              aria-label="Albumin fallback when not measured this draw"
              value={albuminFallback}
              onChange={(e) => setAlbuminFallback(e.currentTarget.value as AlbuminFallback)}
            >
              {ALBUMIN_FALLBACKS.map((fallback) => (
                <option key={fallback} value={fallback}>{albuminFallbackLabel(fallback, unitSystem)}</option>
              ))}
            </select>
          </label>
          <label className="mc-pathway-check">
            <span>Testosterone molar mass</span>
            <select
              className="mc-field mc-field-select mc-field-sm"
              value={tMolarMass}
              onChange={(e) => setTMolarMass(e.currentTarget.value as TMolarMass)}
            >
              {T_MOLAR_MASSES.map((mass) => (
                <option key={mass} value={mass}>{T_MOLAR_MASS_LABEL[mass]}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <Badges snapshot={snapshot} unitSystem={unitSystem} open={open} setOpen={setOpen} setHovered={setHovered} />
      {isCaptionId(open) && cardAt && (
        <CaptionCard id={open} left={cardAt.left} top={cardAt.top} snapshot={snapshot} date={date} unitSystem={unitSystem} />
      )}
      {effectsNode && cardAt && <EffectsCard node={effectsNode} left={cardAt.left} top={cardAt.top} />}
      </div>
      </PathwayContext.Provider>
    </div>
  );
}
