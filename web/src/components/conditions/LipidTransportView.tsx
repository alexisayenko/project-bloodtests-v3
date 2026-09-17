import { useCallback, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Copy } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { CarrierIcon, CholesterolIcon } from './customIcons';
import { SegmentedControl } from '../primitives';
import { ParticleNode, TRIGLYCERIDE_ART } from './Particle3';
import { LIPOPROTEIN_PARTICLES } from '../../data/lipoproteinParticles';
import { computeIndex, indexBands, indexZone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import { convertConcentration } from '../../data/pathwayReferenceRanges';
import type { Result } from '../../types';
import { fmtNum, isOutOfRange } from '../../utils/format';
import { panelDates, type Observation } from './markers';
import { hasReference, type ResultEntry } from './resultsLookup';
import {
  CARD_WIDTH,
  ENZYME_ART,
  SIZE,
  EMPTY,
  NO_REFERENCE,
  associationFor,
  combinedZones,
  keepSources,
  labReference,
  mergeReferences,
  useDismiss,
  useMeasuredLayout,
  useNodeDrag,
  valueText,
  withVariants,
  zoneReference,
  type Association,
  type CitedSource,
  type GlyphArt,
  type Measure,
  type ReferenceInfo,
} from './pathwayShared';
import { ArtworkNote, AssociationLayer, Cites, DateStepper, Glyph, ReferenceBlock, SourcesBlock } from './PathwayParts';

type UnitSystem = 'si' | 'us';

/** The monitoring panel whose results-table dates this page steps through. */
const PANEL_NAME = 'Cardiovascular Risk';

// ---- measures ----

interface MarkerSpec {
  kind: 'marker';
  loinc: string;
  display?: { si: string; us: string; molarMass: string };
}

interface IndexSpec {
  kind: 'index';
  key: string;
}

const CHOLESTEROL_UNITS = { si: 'mmol/L', us: 'mg/dL', molarMass: 'cholesterol' } as const;
const TRIGLYCERIDE_UNITS = { si: 'mmol/L', us: 'mg/dL', molarMass: 'triglyceride' } as const;

const MARKERS = {
  TC: { kind: 'marker', loinc: '2093-3', display: CHOLESTEROL_UNITS },
  TG: { kind: 'marker', loinc: '2571-8', display: TRIGLYCERIDE_UNITS },
  HDL: { kind: 'marker', loinc: '2085-9', display: CHOLESTEROL_UNITS },
  LDL: { kind: 'marker', loinc: '13457-7', display: CHOLESTEROL_UNITS },
  VLDL: { kind: 'marker', loinc: '13458-5', display: CHOLESTEROL_UNITS },
  APOB: { kind: 'marker', loinc: '1884-6' },
  APOA1: { kind: 'marker', loinc: '1869-7' },
  LPA: { kind: 'marker', loinc: '10835-7' },
} as const satisfies Record<string, MarkerSpec>;

const idx = (key: string): IndexSpec => ({ kind: 'index', key });
const defOf = (key: string) => INDEX_DEFS.find((d) => d.key === key);

/** A computed index in mg/dL of cholesterol is shown on the same scale as the lab's cholesterol readings. */
function indexDisplay(key: string) {
  return defOf(key)?.unit === 'mg/dL' ? CHOLESTEROL_UNITS : undefined;
}

function place(value: number, unit: string, display: MarkerSpec['display'], unitSystem: UnitSystem): { value: number; unit: string } {
  const to = display?.[unitSystem];
  const converted = to ? convertConcentration(value, unit, to, display?.molarMass) : undefined;
  return converted === undefined || !to ? { value, unit } : { value: converted, unit: to };
}

const quantityText = (shown: { value: number; unit: string }) => `${fmtNum(shown.value)} ${shown.unit}`.trim();

interface Snapshot {
  marker: (spec: MarkerSpec) => Measure;
  index: (key: string) => Measure;
}

function snapshotOf(
  allResults: readonly ResultEntry[],
  resultsByDate: Record<string, Record<string, Result>>,
  date: string | undefined,
  unitSystem: UnitSystem
): Snapshot {
  const onDate = date ? allResults.filter((e) => e.date === date && e.result.value != null) : [];
  const resultsByLoinc = (date && resultsByDate[date]) || {};
  return {
    marker: (spec) => {
      const codes = withVariants(spec.loinc);
      const hit = onDate.find((e) => codes.includes(e.loinc));
      if (hit?.result.value == null) return EMPTY;
      const unit = hit.result.unit ?? '';
      const shown = place(hit.result.value, unit, spec.display, unitSystem);
      if (!hasReference(hit.result)) return { text: quantityText(shown), unit: shown.unit, status: 'none' };
      const bound = (v: number | null) => (v == null ? undefined : place(v, unit, spec.display, unitSystem));
      const low = bound(hit.result.refMin);
      const high = bound(hit.result.refMax);
      return {
        text: quantityText(shown),
        unit: shown.unit,
        lab: { low: low?.value, high: high?.value, unit: (low ?? high)?.unit ?? unit },
        status: isOutOfRange(hit.result) ? 'bad' : 'ok',
      };
    },
    index: (key) => {
      const def = defOf(key);
      const value = def ? computeIndex(def, resultsByLoinc) : null;
      if (!def || value == null) return EMPTY;
      return { text: quantityText(place(value, def.unit ?? '', indexDisplay(key), unitSystem)), status: indexZone(def, value) ?? 'none' };
    },
  };
}

const measureOf = (spec: MarkerSpec | IndexSpec, snapshot: Snapshot) =>
  spec.kind === 'marker' ? snapshot.marker(spec) : snapshot.index(spec.key);

function referenceOf(spec: MarkerSpec | IndexSpec, measure: Measure, unitSystem: UnitSystem): ReferenceInfo {
  if (spec.kind === 'marker') return measure.lab ? labReference(measure.lab) : NO_REFERENCE;
  const def = defOf(spec.key);
  if (!def) return NO_REFERENCE;
  return zoneReference(def, indexBands(def), (cut) => place(cut, def.unit ?? '', indexDisplay(spec.key), unitSystem));
}

function CalcTag() {
  return <span className="mc-lipid-calc">calc</span>;
}

// ---- badges ----

const regions = (region: string, particles: readonly string[]) => particles.map((p) => `${p}-${region}`);
const ALL_PARTICLES = LIPOPROTEIN_PARTICLES.map((p) => p.id);
const APOB_PILLS = regions('apo', ['vldl', 'idl', 'ldl', 'lpa']);

const APOB_MEANING =
  'Each VLDL, IDL, LDL and Lp(a) particle carries exactly one ApoB-100, so ApoB counts atherogenic particles, while LDL-C measures their cholesterol cargo. When they disagree — e.g. many small, cholesterol-poor LDL particles — ApoB tracks risk more accurately.';

const APOB_SOURCES: readonly CitedSource[] = [
  {
    organization: 'JAMA Cardiology (Sniderman AD, Thanassoulis G, Glavinovic T, et al.)',
    title: 'Apolipoprotein B Particles and Cardiovascular Disease: A Narrative Review',
    url: 'https://doi.org/10.1001/jamacardio.2019.3780',
    year: 2019,
    retrieved: '2026-09-16',
    quote: 'apoB more accurately measures the atherogenic risk owing to the apoB lipoproteins than does low-density lipoprotein cholesterol',
  },
];

/** A block's own citations followed by the spec's, and the numbers the spec's take in that list. */
function withSources(info: ReferenceInfo, sources: readonly CitedSource[] = []): { info: ReferenceInfo; cites: number[] } {
  return { info: { ...info, sources: [...info.sources, ...sources] }, cites: sources.map((_, i) => info.sources.length + i + 1) };
}

interface MethodsSpec {
  reported: MarkerSpec;
  /** The estimate the face falls back to when the lab reported none. */
  fallback: string;
  calculated: readonly (readonly [key: string, method: string])[];
  /** The badge cites only these, in this order, matched by title; INDEX_DEFS keeps the full lists. */
  sourceTitles: readonly string[];
}

interface BadgeSpec {
  id: string;
  name: string;
  measure: MarkerSpec | IndexSpec;
  meaning: string;
  sources?: readonly CitedSource[];
  methods?: MethodsSpec;
  /** The particles the badge's association lines ring. */
  targets: readonly string[];
}

const indexBadge = (key: string, targets: readonly string[]): BadgeSpec => {
  const def = defOf(key);
  return { id: key, name: def?.shortName ?? key, measure: idx(key), meaning: def?.meaning ?? '', targets };
};


const LDL_METHODS: MethodsSpec = {
  reported: MARKERS.LDL,
  fallback: 'ldlmh',
  calculated: [
    ['ldlf', 'Friedewald'],
    ['ldls', 'Sampson'],
    ['ldlmh', 'Martin-Hopkins'],
  ],
  sourceTitles: [
    'Estimation of the concentration of low-density lipoprotein cholesterol',
    'A New Equation for Calculation of Low-Density Lipoprotein Cholesterol',
    'Comparison of a Novel Method vs the Friedewald Equation',
    'Third Report (ATP III)',
  ],
};

const BADGES: readonly BadgeSpec[] = [
  {
    id: 'tc',
    name: 'Total cholesterol',
    measure: MARKERS.TC,
    meaning: 'Cholesterol carried by every particle in the sample, free plus esterified.',
    targets: regions('chol', ALL_PARTICLES),
  },
  {
    id: 'ldl',
    name: 'LDL-C',
    measure: MARKERS.LDL,
    methods: LDL_METHODS,
    meaning:
      'Cholesterol carried in LDL particles. The lab may report it; here it is also estimated from total cholesterol, HDL-C and triglycerides by three equations. Friedewald (1972) subtracts TG ÷ 5 and is not valid at TG ≥ 400 mg/dL; Sampson (2020) stays valid up to TG 800 mg/dL; Martin-Hopkins (2013) replaces the fixed 5 with a divisor looked up from a 180-cell table. Where the estimates agree the value is solid. Targets are risk-stratified; the bands are the NCEP ATP III descriptive categories.',
    targets: ['ldl-chol'],
  },
  {
    id: 'tg',
    name: 'Triglycerides',
    measure: MARKERS.TG,
    meaning: 'Triglycerides carried by every particle in the sample; mostly VLDL when fasting, chylomicrons adding to it after a meal.',
    targets: regions('trig', ALL_PARTICLES),
  },
  {
    id: 'apob',
    name: 'ApoB',
    measure: MARKERS.APOB,
    meaning: APOB_MEANING,
    sources: APOB_SOURCES,
    targets: APOB_PILLS,
  },
  indexBadge('nonhdl', regions('chol', ['chylomicron', 'vldl', 'idl', 'ldl', 'lpa'])),
  indexBadge('remnant', regions('chol', ['chylomicron', 'vldl', 'idl'])),
  indexBadge('tchdl', regions('chol', ALL_PARTICLES)),
  indexBadge('ldlhdl', ['ldl-chol', 'hdl-chol']),
  indexBadge('aip', [...regions('trig', ALL_PARTICLES), 'hdl-chol']),
  indexBadge('apobapoa', [...APOB_PILLS, 'hdl-apo']),
];

/** The reported value when there is one, otherwise the fallback estimate. */
function badgeFace(b: BadgeSpec, snapshot: Snapshot): { measure: Measure; calculated: boolean } {
  const measure = measureOf(b.measure, snapshot);
  if (!b.methods || measure !== EMPTY) return { measure, calculated: false };
  const estimate = snapshot.index(b.methods.fallback);
  return { measure: estimate, calculated: estimate !== EMPTY };
}

function MethodsBody({ badge, methods, snapshot, unitSystem }: Readonly<{ badge: BadgeSpec; methods: MethodsSpec; snapshot: Snapshot; unitSystem: UnitSystem }>) {
  const scope = `lipid-${badge.id}`;
  const reported = snapshot.marker(methods.reported);
  const merged = mergeReferences([
    referenceOf(methods.reported, reported, unitSystem),
    ...methods.calculated.map(([key]) => referenceOf(idx(key), EMPTY, unitSystem)),
  ]);
  const { infos, sources } = keepSources(merged.infos, merged.sources, methods.sourceTitles);
  const [reportedRef, ...calculated] = infos;
  const calculatedRef = combinedZones(
    calculated,
    methods.calculated.map(([, method]) => method)
  );
  return (
    <div className="mc-pathway-badge-body">
      <div className="mc-pathway-badge-section">
        <b>Reported</b>
        <div className="mc-pathway-ref-line">
          <span className="mc-pathway-ref-label">Lab</span>
          <span className="mc-pathway-ref-value">{valueText(reported)}</span>
        </div>
        <ReferenceBlock scope={scope} info={reportedRef} title="Ref range" />
      </div>
      <div className="mc-pathway-badge-section">
        <b>Calculated</b>
        {methods.calculated.map(([key, method]) => (
          <div key={key} className="mc-pathway-ref-line">
            <span className="mc-pathway-ref-label">{method}</span>
            <span className="mc-pathway-ref-value">{valueText(snapshot.index(key))}</span>
          </div>
        ))}
        <ReferenceBlock scope={scope} info={calculatedRef} title="Ref ranges" />
      </div>
      <span>
        <b>Meaning</b> {badge.meaning}
      </span>
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
      {BADGES.map((b) => {
        const expanded = open === b.id;
        const { measure, calculated } = badgeFace(b, snapshot);
        const scope = `lipid-${b.id}`;
        const cited = expanded && !b.methods ? withSources(referenceOf(b.measure, measure, unitSystem), b.sources) : null;
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
                <span className={`mc-pathway-dot mc-pathway-dot-${measure.status}`} />
              </span>
              <span className="mc-pathway-badge-value">
                {valueText(measure)}
                {calculated && <CalcTag />}
              </span>
            </button>
            {expanded && b.methods && <MethodsBody badge={b} methods={b.methods} snapshot={snapshot} unitSystem={unitSystem} />}
            {cited && (
              <div className="mc-pathway-badge-body">
                <ReferenceBlock scope={scope} info={cited.info} />
                <span>
                  <b>Meaning</b> {b.meaning}
                  <Cites scope={scope} cites={cited.cites} />
                </span>
                <SourcesBlock scope={scope} info={cited.info} />
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

// ---- intestine ----

/** Intestine loop silhouette, cropped to its non-transparent bounding box the way LIVER_ART is. */
const INTESTINE_ART: GlyphArt = { src: '/pathways/intestine.png?v=1', width: 237, height: 256, box: [5, 5, 232, 251], size: SIZE.organ };

// ---- liver ----

const HMGCR = 'hmgcr';
const HMGCR_NOTE = 'Rate-limiting enzyme of cholesterol synthesis; the target of statins.';

/** Liver silhouette, cropped to its non-transparent bounding box the way BRAIN_ART is (HormonalPathwaysView.tsx). */
const LIVER_ART: GlyphArt = { src: '/pathways/liver.png?v=1', width: 256, height: 176, box: [4, 4, 252, 172], size: SIZE.organ };

/** Citable note for the nascent-VLDL assembly node, drawing on the same source as HMG-CoA reductase. */
const VLDL_ASSEMBLY_NOTE = "The liver assembles VLDL from triglyceride, cholesterol and ApoB-100 before secreting it into blood.";
const VLDL_FATTY_ACID_SUPPLY_NOTE = 'Fatty acids the liver imports from blood (adipose lipolysis, chylomicron remnants) rather than makes itself, feeding VLDL triglyceride synthesis.';
/** The liver's own triglyceride synthesis, feeding Nascent VLDL alongside the imported fatty acids above -- a plain descriptive tooltip, not a footnoted claim, same discipline level as its sibling TRIG_SYNTH_NOTE (enterocytes). */
const LIVER_TRIG_SYNTH_NOTE = 'The liver esterifies fatty acids into triglyceride (DGAT, via the glycerol-3-phosphate pathway)';

const HMGCR_SOURCES: readonly CitedSource[] = [
  {
    organization: 'Endotext (Feingold KR)',
    title: 'Introduction to Lipids and Lipoproteins',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK305896/',
    year: 2024,
    retrieved: '2026-09-16',
    quote: 'HMG-CoA reductase, the rate limiting enzyme in cholesterol synthesis',
  },
  {
    organization: 'Endotext (Feingold KR)',
    title: 'Cholesterol Lowering Drugs',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK395573/',
    year: 2026,
    retrieved: '2026-09-16',
    quote: 'Statins are competitive inhibitors of HMG-CoA reductase, which leads to a decrease in cholesterol synthesis in the liver',
  },
];

/** The liver at organ size, with HMG-CoA reductase docked on it at molecular size. */
function LiverNode({ open, onToggle }: Readonly<{ open: string | null; onToggle: (id: string, el: HTMLElement) => void }>) {
  return (
    <div className="mc-lipid-organ">
      <div className="mc-lipid-liver">
        <span data-node="liver">
          <Glyph art={LIVER_ART} alt="Liver" />
        </span>
        <button
          type="button"
          className="mc-lipid-enzyme"
          data-caption={HMGCR}
          data-node={HMGCR}
          aria-expanded={open === HMGCR}
          title={HMGCR_NOTE}
          onClick={(e) => onToggle(HMGCR, e.currentTarget)}
        >
          <span className="mc-lipid-enzyme-backdrop" data-node="reductase-bubble">
            <Glyph art={ENZYME_ART} />
          </span>
          <span className="mc-pathway-node-label">HMG-CoA reductase</span>
        </button>
        <span className="mc-lipid-synth-chol" data-node="synth-chol">
          <CholesterolIcon size={STANDALONE_CHOL_ICON_SIZE} />
        </span>
        <div className="mc-lipid-liver-apob" data-node="liver-apob" title={VLDL_ASSEMBLY_NOTE}>
          {/* A structural-apoprotein marker beside HMG-CoA reductase, so it reads at that same molecular-actor size (SIZE.molecular) rather than the bigger standalone-bubble size used for the bare Chol icon above -- not yet on Particle1Node (task-0062-followup): that only renders a GlyphArt raster via Glyph, and this is CarrierIcon, a hand-drawn IconComponent. Pair this with Intestine's enterocyte-apob48 (same role, same size) when converting -- see its own comment for why 'carrier' (SHBG/Albumin-style binding) isn't the right Particle1 type for either. */}
          <CarrierIcon size={SIZE.molecular} />
          <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>ApoB-100</span>
        </div>
        {/* A synthesis marker feeding Nascent VLDL's own TRIG stack, fanned out between liver-apob (straight down from the reductase) and synth-chol (right of it), matching how fatty acids arrive at the liver and get handed off to this node -- not yet on Particle1Node (task-0062-followup), though as a GlyphArt-based byproduct marker (same shape as LPL's fatty-acids node) it's the cheaper of the two conversions once that lands. */}
        <div className="mc-lipid-liver-trig" data-node="liver-trig" title={LIVER_TRIG_SYNTH_NOTE}>
          <Glyph art={{ ...TRIGLYCERIDE_ART, size: SIZE.molecular }} alt="Triglyceride" />
          <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>TRIG</span>
        </div>
      </div>
    </div>
  );
}

function EnzymeCard({ left, top }: Readonly<{ left: number; top: number }>) {
  const scope = `lipid-${HMGCR}`;
  return (
    <dialog open className="mc-pathway-pop" aria-label="HMG-CoA reductase" style={{ left, top, width: CARD_WIDTH, margin: 0 }}>
      <div className="mc-pathway-pop-title">HMG-CoA reductase</div>
      <p className="mc-pathway-pop-note">
        The rate-limiting enzyme in cholesterol synthesis
        <Cites scope={scope} cites={[1]} />; statins inhibit it, lowering the liver's cholesterol synthesis
        <Cites scope={scope} cites={[2]} />.
      </p>
      <SourcesBlock scope={scope} info={{ headCites: [], lines: [], sources: [...HMGCR_SOURCES] }} />
    </dialog>
  );
}

/** Badge-to-particle association lines, measured from the DOM like Hormonal Pathways' and hidden at rest. */
type Point = { x: number; y: number };
const rectCenter = (r: DOMRect, base: DOMRect): Point => ({ x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top });
/** A point on the line from `from` to `to`, pulled back `radius` px from `from` -- lets a bond meet a circle radially instead of at a fixed side point. */
const onEdge = (from: Point, to: Point, radius: number): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  return { x: from.x + (dx / dist) * radius, y: from.y + (dy / dist) * radius };
};

function LipidAssociations({ root, active, focused, layoutKey }: Readonly<{ root: RefObject<HTMLDivElement | null>; active: string | null; focused: string | null; layoutKey: string }>) {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [veil, setVeil] = useState<{ w: number; h: number } | null>(null);
  const [secretion, setSecretion] = useState<string | null>(null);
  const [ldlUptake, setLdlUptake] = useState<string | null>(null);
  const [chainArrows, setChainArrows] = useState<string[]>([]);
  const [lplArrow, setLplArrow] = useState<string | null>(null);
  const [particleBonds, setParticleBonds] = useState<string[]>([]);
  const [particleOutlines, setParticleOutlines] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [synthArrow, setSynthArrow] = useState<string | null>(null);
  const [enterocyteTrigArrow, setEnterocyteTrigArrow] = useState<string | null>(null);
  const [enterocyteApoB48Arrow, setEnterocyteApoB48Arrow] = useState<string | null>(null);
  const [cholToVldlArrow, setCholToVldlArrow] = useState<string | null>(null);
  const [liverTrigArrow, setLiverTrigArrow] = useState<string | null>(null);
  const [apoB100Arrow, setApoB100Arrow] = useState<string | null>(null);
  const [trigToChylomicronArrow, setTrigToChylomicronArrow] = useState<string | null>(null);
  const [apoB48ToChylomicronArrow, setApoB48ToChylomicronArrow] = useState<string | null>(null);
  const [faSupplyArrow, setFaSupplyArrow] = useState<string | null>(null);
  const [liverToTrigArrow, setLiverToTrigArrow] = useState<string | null>(null);
  const [liverToApobArrow, setLiverToApobArrow] = useState<string | null>(null);
  const [retentionArrows, setRetentionArrows] = useState<string[]>([]);
  useMeasuredLayout(root, layoutKey, (el) => {
    const base = el.getBoundingClientRect();
    const vldl = el.querySelector('[data-node="vldl"]')?.getBoundingClientRect();
    const nascentVldl = el.querySelector('[data-node="vldl-construction"]')?.getBoundingClientRect();
    setSecretion(
      nascentVldl && vldl
        ? (() => {
            const r = rectCenter(nascentVldl, base);
            const s = rectCenter(vldl, base);
            const from = onEdge(r, s, nascentVldl.height / 2 + 3);
            const to = onEdge(s, r, vldl.height / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    const idl = el.querySelector('[data-node="idl"]')?.getBoundingClientRect();
    const ldl = el.querySelector('[data-node="ldl"]')?.getBoundingClientRect();
    const targetCells = el.querySelector('[data-node="target-cells"]')?.getBoundingClientRect();
    // VLDL -> IDL -> LDL is one particle transforming, so each hop (and LDL's own handoff to Peripheral cells, now beside it in the same row) is drawn as a short horizontal arrow through the gap between the two boxes, at the holder apoprotein's own height -- never crossing either particle's TRIG/Chol circles, which sit to the sides of that gap, not in it.
    const vldlApo = el.querySelector('[data-node="vldl-apo"]')?.getBoundingClientRect();
    const idlApo = el.querySelector('[data-node="idl-apo"]')?.getBoundingClientRect();
    const ldlApo = el.querySelector('[data-node="ldl-apo"]')?.getBoundingClientRect();
    setLdlUptake(
      ldl && targetCells && ldlApo
        ? (() => {
            const x = ldlApo.left + ldlApo.width / 2 - base.left;
            const y0 = ldl.bottom - base.top;
            const y1 = targetCells.top + targetCells.height / 2 - base.top;
            const x1 = targetCells.left - base.left;
            return `M${x},${y0} L${x},${y1} L${x1},${y1}`;
          })()
        : null
    );
    const chain: string[] = [];
    if (vldl && idl && vldlApo) {
      const y = vldlApo.top + vldlApo.height / 2 - base.top;
      chain.push(`M${vldl.right - base.left},${y} L${idl.left - base.left},${y}`);
    }
    if (idl && ldl && idlApo) {
      const y = idlApo.top + idlApo.height / 2 - base.top;
      chain.push(`M${idl.right - base.left},${y} L${ldl.left - base.left},${y}`);
    }
    setChainArrows(chain);
    // Retention: LDL, IDL and Lp(a) each get a dashed arrow (a zone-crossing, like faSupplyArrow below) from their own ApoB-100 down to the artery-wall strip's own drawn gap in the endothelium -- never from VLDL, which the diagram omits per RETENTION_SOURCES' size ceiling.
    const lpaApo = el.querySelector('[data-node="lpa-apo"]')?.getBoundingClientRect();
    const arteryGap = el.querySelector(`[data-node="${ARTERY_GAP}"]`)?.getBoundingClientRect();
    setRetentionArrows(
      arteryGap
        ? [idlApo, ldlApo, lpaApo].flatMap((apo) => {
            if (!apo) return [];
            const from = rectCenter(apo, base);
            const to = rectCenter(arteryGap, base);
            const start = onEdge(from, to, apo.width / 2 + 3);
            const end = onEdge(to, from, arteryGap.width / 2 + 3);
            return [`M${start.x},${start.y} L${end.x},${end.y}`];
          })
        : []
    );
    // VLDL's separate fate for its shed triglyceride: a path down to LPL's own bubble, then straight down again to the fatty-acid glyph directly below it, then on to Muscle and Adipocytes -- one continuous arrow, kept apart from the LDL-uptake one above.
    const lplBubble = el.querySelector('[data-node="lpl-bubble"]')?.getBoundingClientRect();
    const fattyAcids = el.querySelector('[data-node="fatty-acids"]')?.getBoundingClientRect();
    const lplMuscle = el.querySelector('[data-node="lpl-muscle"]')?.getBoundingClientRect();
    const lplAdipocytes = el.querySelector('[data-node="lpl-adipocytes"]')?.getBoundingClientRect();
    setLplArrow(
      vldl && lplBubble && fattyAcids
        ? [
            `M${vldl.left - base.left + 20},${vldl.bottom - base.top + 2} L${lplBubble.left + lplBubble.width / 2 - base.left},${lplBubble.top - base.top - 4}`,
            `M${lplBubble.left + lplBubble.width / 2 - base.left},${lplBubble.bottom - base.top + 2} L${fattyAcids.left + fattyAcids.width / 2 - base.left},${fattyAcids.top - base.top - 2}`,
            ...(lplMuscle
              ? [
                  (() => {
                    const r = rectCenter(fattyAcids, base);
                    const s = rectCenter(lplMuscle, base);
                    const from = onEdge(r, s, fattyAcids.width / 2 + 3);
                    const to = onEdge(s, r, lplMuscle.width / 2 + 5);
                    return `M${from.x},${from.y} L${to.x},${to.y}`;
                  })(),
                ]
              : []),
            ...(lplAdipocytes
              ? [
                  (() => {
                    const r = rectCenter(fattyAcids, base);
                    const s = rectCenter(lplAdipocytes, base);
                    const from = onEdge(r, s, fattyAcids.width / 2 + 3);
                    const to = onEdge(s, r, lplAdipocytes.width / 2 + 5);
                    return `M${from.x},${from.y} L${to.x},${to.y}`;
                  })(),
                ]
              : []),
          ].join(' ')
        : null
    );
    // Every particle (VLDL, IDL, LDL, chylomicron, HDL, Lp(a)) gets its own TRIG/Chol bonds to its holder apoprotein and a dashed outline hugging its actual icons.
    const bonds: string[] = [];
    const outlines: { x: number; y: number; w: number; h: number }[] = [];
    for (const id of ['vldl', 'idl', 'ldl', 'chylomicron', 'hdl', 'lpa', 'vldl-construction']) {
      const trig = el.querySelector(`[data-node="${id}-trig"]`)?.getBoundingClientRect();
      const apo = el.querySelector(`[data-node="${id}-apo"]`)?.getBoundingClientRect();
      const chol = el.querySelector(`[data-node="${id}-chol"]`)?.getBoundingClientRect();
      if (!trig || !apo || !chol) continue;
      const a = rectCenter(apo, base);
      const c = rectCenter(chol, base);
      const t = rectCenter(trig, base);
      const apoRadius = apo.width / 2 + 3;
      const cholEdge = onEdge(c, a, chol.width / 2 + 2);
      const apoFromC = onEdge(a, c, apoRadius);
      const trigEdge = onEdge(t, a, trig.width / 2 + 2);
      const apoFromT = onEdge(a, t, apoRadius);
      const bond = `M${cholEdge.x},${cholEdge.y} L${apoFromC.x},${apoFromC.y} M${trigEdge.x},${trigEdge.y} L${apoFromT.x},${apoFromT.y}`;
      // ApoB-100's own caption is wider than its icon, so it can overhang the icon's own bounds -- include it so the box never clips it.
      const apoCaption = el.querySelector(`[data-node="${id}-apo"]`)?.closest('.mc-pathway-anchor')?.querySelector('.mc-pathway-caption')?.getBoundingClientRect();
      const left = Math.min(chol.left, apo.left, trig.left, apoCaption?.left ?? Infinity) - base.left;
      const right = Math.max(chol.right, apo.right, apoCaption?.right ?? -Infinity) - base.left;
      const top = Math.min(chol.top, apo.top, trig.top) - base.top;
      bonds.push(bond);
      const pad = 10;
      outlines.push({ x: left - pad, y: top - pad, w: right - left + pad * 2, h: apo.bottom - base.top + 26 - (top - pad) });
    }
    setParticleBonds(bonds);
    setParticleOutlines(outlines);
    const reductase = el.querySelector('[data-node="reductase-bubble"]')?.getBoundingClientRect();
    const synthChol = el.querySelector('[data-node="synth-chol"]')?.getBoundingClientRect();
    setSynthArrow(
      reductase && synthChol
        ? (() => {
            const r = rectCenter(reductase, base);
            const s = rectCenter(synthChol, base);
            const from = onEdge(r, s, reductase.width / 2 + 3);
            const to = onEdge(s, r, synthChol.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    const vldlConstructionChol = el.querySelector('[data-node="vldl-construction-chol"]')?.getBoundingClientRect();
    setCholToVldlArrow(
      synthChol && vldlConstructionChol
        ? (() => {
            const r = rectCenter(synthChol, base);
            const s = rectCenter(vldlConstructionChol, base);
            const from = onEdge(r, s, synthChol.width / 2 + 3);
            const to = onEdge(s, r, vldlConstructionChol.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    const vldlConstructionTrig = el.querySelector('[data-node="vldl-construction-trig"]')?.getBoundingClientRect();
    const vldlConstructionApo = el.querySelector('[data-node="vldl-construction-apo"]')?.getBoundingClientRect();
    // The liver's own TRIG synthesis is a standalone node (liver-trig) rather than the organ's bare bottom edge, since it also doubles as the landing point for the imported-fatty-acids arrow below.
    const liverTrig = el.querySelector('[data-node="liver-trig"]')?.getBoundingClientRect();
    const liverApob = el.querySelector('[data-node="liver-apob"]')?.getBoundingClientRect();
    setLiverTrigArrow(
      liverTrig && vldlConstructionTrig
        ? (() => {
            const r = rectCenter(liverTrig, base);
            const s = rectCenter(vldlConstructionTrig, base);
            const from = onEdge(r, s, liverTrig.width / 2 + 3);
            const to = onEdge(s, r, vldlConstructionTrig.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    setApoB100Arrow(
      liverApob && vldlConstructionApo
        ? (() => {
            const r = rectCenter(liverApob, base);
            const s = rectCenter(vldlConstructionApo, base);
            const from = onEdge(r, s, liverApob.width / 2 + 3);
            const to = onEdge(s, r, vldlConstructionApo.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    // Free fatty acids circulate in Blood Transport (adipose lipolysis, chylomicron remnants) before the liver takes them up -- this arrow crosses the zone boundary and lands on the liver itself, which then hands off to its own TRIG synthesis (liver-trig) as a separate step, rather than jumping straight to liver-trig.
    const faSupply = el.querySelector('[data-node="fa-supply"]')?.getBoundingClientRect();
    const liverOrgan = el.querySelector('[data-node="liver"]')?.getBoundingClientRect();
    setFaSupplyArrow(
      faSupply && liverOrgan
        ? (() => {
            // Straight vertical: fatty acids rise from Blood Transport straight up into the liver, at the fa-supply icon's own x.
            const x = faSupply.left + faSupply.width / 2 - base.left;
            const fromY = faSupply.top - base.top - 3;
            const toY = liverOrgan.bottom - base.top + 5;
            return `M${x},${fromY} L${x},${toY}`;
          })()
        : null
    );
    setLiverToTrigArrow(
      liverOrgan && liverTrig
        ? (() => {
            // Starts from the liver's own bottom edge, not its center -- a center-based edge projection lands right next to HMG-CoA reductase (which sits near the middle of the liver artwork), wrongly implying the enzyme makes TRIG too.
            const from = { x: liverOrgan.left + liverOrgan.width / 2 - base.left, y: liverOrgan.bottom - base.top - 3 };
            const s = rectCenter(liverTrig, base);
            const to = onEdge(s, from, liverTrig.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    setLiverToApobArrow(
      liverOrgan && liverApob
        ? (() => {
            // Straight vertical, same treatment as the fatty-acids arrow -- the liver produces ApoB-100 straight down from itself.
            const x = liverApob.left + liverApob.width / 2 - base.left;
            const fromY = liverOrgan.bottom - base.top - 3;
            const toY = liverApob.top - base.top + 5;
            return `M${x},${fromY} L${x},${toY}`;
          })()
        : null
    );
    const enterocytes = el.querySelector('[data-node="enterocytes"]')?.getBoundingClientRect();
    const enterocyteTrig = el.querySelector('[data-node="enterocyte-trig"]')?.getBoundingClientRect();
    const enterocyteApoB48 = el.querySelector('[data-node="enterocyte-apob48"]')?.getBoundingClientRect();
    setEnterocyteTrigArrow(
      enterocytes && enterocyteTrig
        ? (() => {
            const r = rectCenter(enterocytes, base);
            const s = rectCenter(enterocyteTrig, base);
            const from = onEdge(r, s, enterocytes.width / 2 + 3);
            const to = onEdge(s, r, enterocyteTrig.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    setEnterocyteApoB48Arrow(
      enterocytes && enterocyteApoB48
        ? (() => {
            const r = rectCenter(enterocytes, base);
            const s = rectCenter(enterocyteApoB48, base);
            const from = onEdge(r, s, enterocytes.width / 2 + 3);
            const to = onEdge(s, r, enterocyteApoB48.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    const chylomicronTrig = el.querySelector('[data-node="chylomicron-trig"]')?.getBoundingClientRect();
    const chylomicronApo = el.querySelector('[data-node="chylomicron-apo"]')?.getBoundingClientRect();
    setTrigToChylomicronArrow(
      enterocyteTrig && chylomicronTrig
        ? (() => {
            const r = rectCenter(enterocyteTrig, base);
            const s = rectCenter(chylomicronTrig, base);
            const from = onEdge(r, s, enterocyteTrig.width / 2 + 3);
            const to = onEdge(s, r, chylomicronTrig.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    setApoB48ToChylomicronArrow(
      enterocyteApoB48 && chylomicronApo
        ? (() => {
            const r = rectCenter(enterocyteApoB48, base);
            const s = rectCenter(chylomicronApo, base);
            const from = onEdge(r, s, enterocyteApoB48.width / 2 + 3);
            const to = onEdge(s, r, chylomicronApo.width / 2 + 5);
            return `M${from.x},${from.y} L${to.x},${to.y}`;
          })()
        : null
    );
    const box = el.querySelector('.mc-lipid-particles')?.getBoundingClientRect();
    if (box) setVeil({ w: box.right - base.left, h: box.bottom - base.top });
    // A region with no sourced area in Data mode is not drawn, so its particle's outline is ringed instead.
    const present = (targets: readonly string[]) => [
      ...new Set(targets.map((t) => (el.querySelector(`[data-node="${t}"]`) ? t : t.split('-')[0]))),
    ];
    setAssociations(BADGES.flatMap((b) => associationFor(el, base, b.id, present(b.targets))));
  });
  return (
    <svg className="mc-pathway-overlay" aria-hidden="true">
      <defs>
        <marker id="mc-lipid-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="currentColor" />
        </marker>
      </defs>
      {secretion && <path d={secretion} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {ldlUptake && <path d={ldlUptake} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {chainArrows.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />
      ))}
      {lplArrow && <path d={lplArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {synthArrow && <path d={synthArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {cholToVldlArrow && <path d={cholToVldlArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {liverTrigArrow && <path d={liverTrigArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {apoB100Arrow && <path d={apoB100Arrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {faSupplyArrow && <path d={faSupplyArrow} fill="none" stroke="currentColor" strokeWidth={1.25} strokeDasharray="3 3" markerEnd="url(#mc-lipid-head)" />}
      {liverToTrigArrow && <path d={liverToTrigArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {liverToApobArrow && <path d={liverToApobArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {retentionArrows.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.25} strokeDasharray="3 3" markerEnd="url(#mc-lipid-head)" />
      ))}
      {enterocyteTrigArrow && <path d={enterocyteTrigArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {enterocyteApoB48Arrow && <path d={enterocyteApoB48Arrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {trigToChylomicronArrow && <path d={trigToChylomicronArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {apoB48ToChylomicronArrow && <path d={apoB48ToChylomicronArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {particleBonds.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--navy)" strokeWidth={1.5} />
      ))}
      {particleOutlines.map((o, i) => (
        // A fixed 14px radius would round LDL's own (near-square, 1-TRIG/1-Chol) box into a pill or circle;
        // capping it to at most a third of the box's own shorter side keeps every particle's outline reading
        // as a rounded rectangle, LDL included, whatever its own box shape happens to be.
        <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} rx={Math.min(10, o.w / 3, o.h / 3)} fill="none" stroke="var(--lipid-outline)" strokeWidth={1.5} strokeDasharray="4 3" />
      ))}
      <AssociationLayer associations={associations} active={active} focused={focused} veil={veil} />
    </svg>
  );
}

// ---- cargo diagram ----

/** The bare cholesterol icon by the liver has no bubble to fill, so it reads at a bigger, more visible size than the docked one -- roomier than a bare signal molecule on Hormonal Pathways (SIZE.molecular). */
const STANDALONE_CHOL_ICON_SIZE = Math.round(SIZE.molecular * 1.35 * 1.3);

// ---- lipoprotein chain ----

/** LDL is the particle that actually reaches peripheral cells; not yet in lipoprotein-particles.json's cited sources (task-0060's F11 is marked "to retrieve"), so kept brief rather than sourced. */
const LDL_UPTAKE_NOTE = 'LDL delivers cholesterol to peripheral cells via the LDL receptor';

/** Same cell artwork Hormonal Pathways uses for Sertoli/Leydig -- generic tissue cells, not organ-specific. */
const CELLS_ART: GlyphArt = { src: '/pathways/leydig-cells.png', width: 50, height: 50, box: [7, 6, 48, 46], size: SIZE.cell };

/** Where LDL delivers its cholesterol -- sits to the right of LDL, at the end of the chain row. Labeled "Peripheral cells", the standard lipidology term for LDL-receptor uptake by non-liver body cells; `data-node="target-cells"` is kept as-is since the arrow measurement above queries it. */
function TargetCellsNode() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node="target-cells" title={LDL_UPTAKE_NOTE}>
      <Glyph art={CELLS_ART} />
      <span className="mc-pathway-node-label" style={{ marginTop: 8 }}>Peripheral cells</span>
    </div>
  );
}

/** Same cell artwork as target cells / Sertoli-Leydig -- generic tissue cells packaging absorbed fat, not yet wired to any measured arrow. */
const ENTEROCYTES_NOTE = 'Intestinal cells that package absorbed dietary fat into chylomicrons';
const TRIG_SYNTH_NOTE = 'Enterocytes re-esterify absorbed fatty acids into triglyceride (MGAT/DGAT)';
const APOB48_SYNTH_NOTE = 'Enterocytes splice a stop codon into ApoB mRNA, producing the truncated ApoB-48';

function EnterocytesNode() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node="enterocytes" title={ENTEROCYTES_NOTE}>
      <Glyph art={CELLS_ART} />
      <span className="mc-pathway-node-label" style={{ marginTop: 8 }}>Enterocytes</span>
    </div>
  );
}

/**
 * VLDL's separate fate for its shed triglyceride: lipoprotein lipase (LPL)
 * strips fatty acids from VLDL's TG as it becomes IDL/LDL, releasing them to
 * muscle for energy and fat tissue for storage -- a different, real pathway
 * from LDL's own cholesterol delivery above, so it gets its own arrow rather
 * than merging with `LDL_UPTAKE_NOTE`. The fatty-acid glyph is
 * `FattyAcidClusterIcon`, several loose carbon-chain tails scattered in one
 * icon (not `TriglycerideIcon`'s three tails on one glycerol backbone),
 * since LPL releases individual fatty acids rather than whole triglycerides.
 * Muscle and Adipocytes reuse the same generic cell artwork as Peripheral
 * cells and Enterocytes (`CELLS_ART`), for the same reason: no
 * tissue-specific artwork exists yet.
 */
const LPL_NOTE = 'Lipoprotein lipase';
const LPL_ARROW_NOTE = "Lipoprotein lipase releases fatty acids from VLDL's triglycerides for muscle energy and fat storage";
const FATTY_ACID_ICON_SIZE = 34;
/** Fatty-acid cluster glyph, cropped to its non-transparent bounding box the way LIVER_ART is. `size` is overridden per call site, since Glyph bakes its render size into the art object. */
const FATTY_ACID_ART: GlyphArt = { src: '/pathways/fatty-acid.png?v=1', width: 824, height: 833, box: [6, 6, 818, 827], size: SIZE.molecular };

function CellDestination({ label, dataNode }: Readonly<{ label: string; dataNode?: string }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node={dataNode}>
      <Glyph art={CELLS_ART} />
      <span className="mc-pathway-node-label" style={{ marginTop: 8 }}>{label}</span>
    </div>
  );
}

function LplBranch() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 36 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={LPL_NOTE}>
          <span data-node="lpl-bubble">
            <Glyph art={ENZYME_ART} />
          </span>
          <span className="mc-pathway-node-label">LPL</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node="fatty-acids" title={LPL_ARROW_NOTE}>
          <Glyph art={{ ...FATTY_ACID_ART, size: FATTY_ACID_ICON_SIZE }} alt="Fatty acids" />
          <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>fatty acids</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <CellDestination label="Muscle" dataNode="lpl-muscle" />
        <CellDestination label="Adipocytes" dataNode="lpl-adipocytes" />
      </div>
    </div>
  );
}

/**
 * The endogenous lipoprotein pathway: the liver's secreted VLDL loses
 * triglyceride and becomes IDL, then LDL -- one ApoB-100 particle
 * transforming, not three separate ones. Each stage keeps its own cargo
 * diagram, its TRIG and Chol circle counts both falling down the chain as
 * the particle sheds mass. Peripheral cells sits beside LDL, at the end of
 * the row, since it is LDL -- not VLDL -- that delivers cholesterol to it.
 * The gap between the row and it eases with the container's own width
 * (`--pw-fit-ldl-gap`, defined alongside Hormonal Pathways' own `--pw-fit-*`
 * variables on the shared `.mc-pathway-bands` container-query root), so it
 * still clears the badge column at a narrower viewport instead of running
 * under it.
 */
function LipoproteinChain() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--pw-fit-chain-gap, 76px)' }}>
      <ParticleNode id="vldl" label="VLDL" trigCount={3} cholCount={3} trigOverlap={4} />
      <ParticleNode id="idl" label="IDL" trigCount={2} cholCount={2} trigOverlap={4} />
      <ParticleNode id="ldl" label="LDL" trigCount={1} cholCount={1} />
    </div>
  );
}

// ---- arterial wall ----

/** Cross-section strip (endothelium, intima, media), cropped to its non-transparent bounding box the way LIVER_ART is -- wide and short (~4.8:1 content), so it is sized as a horizontal band via a custom `size` rather than SIZE.organ's small square. */
const ARTERY_WALL_ART: GlyphArt = { src: '/pathways/artery-wall.png?v=1', width: 1648, height: 355, box: [6, 6, 1642, 349], size: 760 };

const RETENTION = 'retention';
const ARTERY_GAP = 'artery-gap';

/** Plain hover summary on the zone and the arrows landing on it; the clickable gap chip carries the full cited claim (RetentionCard). */
const RETENTION_NOTE =
  'LDL, IDL and Lp(a) cross a damaged endothelium and are retained by ApoB-100 binding intima proteoglycans; particles above ~70 nm, including VLDL, mostly cannot cross this way, so no arrow is drawn from it.';

/**
 * Response-to-retention mechanism (Williams KJ, Tabas I 1995) and the
 * particle-size ceiling on which apoB lipoproteins can cross the
 * endothelium at all, both restated with the same wording in the 2020 EAS
 * Consensus Panel review -- one retrievable, quotable source for both
 * claims, so cited once rather than compounding sources. Deliberately no
 * VLDL arrow: task-0062's own read of this source is that large VLDL sits
 * above the ~70 nm ceiling the second quote gives, so omission (not an
 * invented threshold) is the correct call for that particle.
 */
const RETENTION_SOURCES: readonly CitedSource[] = [
  {
    organization: 'European Heart Journal (Borén J, Chapman MJ, Krauss RM, et al.; European Atherosclerosis Society Consensus Panel)',
    title: 'Low-density lipoproteins cause atherosclerotic cardiovascular disease: pathophysiological, genetic, and therapeutic insights',
    // Same paper as the second entry below; SourcesBlock keys each source by title|url, so the two carry distinct (harmless) URL fragments to stay unique rather than colliding as React list keys.
    url: 'https://doi.org/10.1093/eurheartj/ehz962#retention',
    year: 2020,
    retrieved: '2026-09-17',
    quote:
      'positively charged amino acyl residues (arginine and lysine) in apoB100 with negatively charged sulfate and carboxylic acid groups of arterial wall proteoglycans',
  },
  {
    organization: 'European Heart Journal (Borén J, Chapman MJ, Krauss RM, et al.; European Atherosclerosis Society Consensus Panel)',
    title: 'Low-density lipoproteins cause atherosclerotic cardiovascular disease: pathophysiological, genetic, and therapeutic insights',
    url: 'https://doi.org/10.1093/eurheartj/ehz962#size-limit',
    year: 2020,
    retrieved: '2026-09-17',
    quote: 'Apolipoprotein B-containing lipoproteins of up to ∼70 nm in diameter […] can cross the endothelium',
  },
];

/**
 * PathwayParts' own `Glyph` always renders a SQUARE box (art.size × art.size),
 * fine for the organ/cell/molecular icons it was built for (all inscribed in
 * a square slot, some letterboxed) but wrong for this strip's ~4.8:1 content
 * -- a square slot would leave it a sliver in the middle of mostly empty
 * space. This sizes the box to art.size × its own aspect-derived height
 * instead, the same crop-to-content-bbox technique applied on a rectangle.
 */
function WideGlyph({ art, alt = '' }: Readonly<{ art: GlyphArt; alt?: string }>) {
  const [left, top, right, bottom] = art.box;
  const scale = art.size / (right - left);
  const height = (bottom - top) * scale;
  const style: CSSProperties = { width: art.width * scale, height: art.height * scale, left: -left * scale, top: -top * scale };
  return (
    <span className="mc-pathway-glyph" style={{ width: art.size, height }}>
      <img src={art.src} alt={alt} style={style} />
    </span>
  );
}

/** The artery-wall strip with a clickable point over the endothelium's own drawn gap -- both the retention arrows from LDL/IDL/Lp(a) and RetentionCard land here. */
function ArteryWallNode({ open, onToggle }: Readonly<{ open: string | null; onToggle: (id: string, el: HTMLElement) => void }>) {
  return (
    <div className="mc-lipid-artery">
      <WideGlyph art={ARTERY_WALL_ART} alt="Arterial wall cross-section" />
      <button
        type="button"
        className="mc-lipid-artery-gap"
        data-caption={RETENTION}
        data-node={ARTERY_GAP}
        aria-expanded={open === RETENTION}
        aria-label="Arterial retention"
        title={RETENTION_NOTE}
        onClick={(e) => onToggle(RETENTION, e.currentTarget)}
      />
    </div>
  );
}

function RetentionCard({ left, top }: Readonly<{ left: number; top: number }>) {
  const scope = `lipid-${RETENTION}`;
  return (
    <dialog open className="mc-pathway-pop" aria-label="Arterial retention" style={{ left, top, width: CARD_WIDTH, margin: 0 }}>
      <div className="mc-pathway-pop-title">Arterial retention</div>
      <p className="mc-pathway-pop-note">
        LDL, IDL and Lp(a) cross a damaged endothelium and are retained in the intima, their ApoB-100 binding arterial-wall proteoglycans
        <Cites scope={scope} cites={[1]} />. Only particles up to about 70 nm can cross the endothelium this way -- too small a ceiling for VLDL, which is why the diagram draws no arrow from it
        <Cites scope={scope} cites={[2]} />.
      </p>
      <SourcesBlock scope={scope} info={{ headCites: [], lines: [], sources: [...RETENTION_SOURCES] }} />
    </dialog>
  );
}

// ---- page ----

export function LipidTransportView({
  allResults,
  resultsByDate,
  panelTests,
  unitSystem,
  onUnitSystemChange,
}: Readonly<{
  allResults: readonly ResultEntry[];
  resultsByDate: Record<string, Record<string, Result>>;
  /** The Cardiovascular Risk panel's observations, whose results-table dates the stepper lists. */
  panelTests: readonly Observation[];
  unitSystem: UnitSystem;
  onUnitSystemChange: (unitSystem: UnitSystem) => void;
}>) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [cardAt, setCardAt] = useState<{ left: number; top: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const { drags, activeId, reset: resetDrags } = useNodeDrag(layoutRef, debug);
  const toggleDebug = useCallback(() => {
    setDebug((prev) => {
      if (prev) resetDrags();
      return !prev;
    });
  }, [resetDrags]);
  const dates = useMemo(() => panelDates(PANEL_NAME, panelTests, allResults).reverse(), [panelTests, allResults]);
  const date = picked && dates.includes(picked) ? picked : dates.at(-1);
  const snapshot = useMemo(() => snapshotOf(allResults, resultsByDate, date, unitSystem), [allResults, resultsByDate, date, unitSystem]);

  const placeCard = useCallback((chip: Element) => {
    const layout = layoutRef.current;
    if (!layout) return null;
    const a = chip.getBoundingClientRect();
    const box = layout.getBoundingClientRect();
    const left = Math.min(Math.max(a.left + a.width / 2 - box.left - CARD_WIDTH / 2, 0), Math.max(box.width - CARD_WIDTH, 0));
    return { left, top: a.bottom - box.top + 6 };
  }, []);

  const toggleChip = useCallback(
    (id: string, el: HTMLElement) => {
      if (open === id) {
        setOpen(null);
        return;
      }
      setCardAt(placeCard(el));
      setOpen(id);
    },
    [open, placeCard]
  );

  const close = useCallback(() => setOpen(null), []);
  const replaceCard = useCallback(() => {
    const chip = layoutRef.current?.querySelector(`[data-caption="${open}"]`);
    if (chip) setCardAt(placeCard(chip));
  }, [open, placeCard]);
  useDismiss(open, close, '.mc-pathway-pop, [data-caption], [data-badge]', replaceCard);

  const badgeOpen = open === HMGCR || open === RETENTION ? null : open;
  return (
    <div>
      <PageHeader
        overline="Lipidology"
        titlePrimary="Lipid"
        titleAccent="Transport"
        description={['How fat and cholesterol travel through the blood, particle by particle']}
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
        <button
          type="button"
          onClick={toggleDebug}
          title="Dev-only: drag a diagram node to see the pixel offset it moved"
          aria-pressed={debug}
          style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: debug ? '1px solid #b83227' : '1px solid #ccc',
            background: debug ? '#b83227' : '#fff',
            color: debug ? '#fff' : '#333',
            cursor: 'pointer',
          }}
        >
          {debug ? 'Debug: ON' : 'Debug'}
        </button>
      </div>
      <ArtworkNote>The liver and artery-wall images are illustrative.</ArtworkNote>
      <div className="mc-pathway-layout" ref={layoutRef} style={debug ? { cursor: 'grab' } : undefined}>
        <LipidAssociations root={layoutRef} active={hovered ?? badgeOpen} focused={badgeOpen} layoutKey={`${date ?? ''}|${unitSystem}`} />
        <div className="mc-pathway-main">
          <div className="mc-pathway-bands">
            <section className="mc-pathway-band" aria-label="Liver">
              <div className="mc-pathway-site">
                <h2 className="mc-pathway-title" title="Synthesizes cholesterol and secretes VLDL into the blood">Liver</h2>
              </div>
              <div className="mc-pathway-diagram">
                <div className="mc-lipid-particles">
                  <LiverNode open={open} onToggle={toggleChip} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: -20, marginLeft: 291 }}>
                  <div title={VLDL_ASSEMBLY_NOTE}>
                    <ParticleNode id="vldl-construction" label="Nascent VLDL" trigCount={3} cholCount={3} trigOverlap={4} />
                  </div>
                </div>
              </div>
            </section>
            <section className="mc-pathway-band" aria-label="Blood Transport">
              <div className="mc-pathway-site">
                <h2 className="mc-pathway-title" title="VLDL sheds triglyceride and becomes IDL, then LDL">Blood Transport</h2>
              </div>
              <div className="mc-pathway-diagram">
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} data-node="fa-supply" title={VLDL_FATTY_ACID_SUPPLY_NOTE}>
                    <Glyph art={{ ...FATTY_ACID_ART, size: 28 }} alt="Fatty acids" />
                    <span className="mc-pathway-node-label" style={{ fontSize: 10 }}>fatty acids</span>
                  </div>
                </div>
                <LipoproteinChain />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, marginBottom: 24 }}>
                  <TargetCellsNode />
                </div>
                <div style={{ display: 'flex', gap: 44, justifyContent: 'flex-end' }}>
                  <ParticleNode id="hdl" label="HDL" holder="ApoA-I" trigCount={1} cholCount={1} />
                  <ParticleNode id="lpa" label="Lp(a)" holder="ApoB-100" extraApo="apo(a)" trigCount={1} cholCount={1} />
                </div>
                <LplBranch />
              </div>
            </section>
            <section className="mc-pathway-band" aria-label="Arterial Wall">
              <div className="mc-pathway-site">
                <h2 className="mc-pathway-title" title="LDL, IDL and Lp(a) cross a damaged endothelium and are retained by ApoB-100 binding intima proteoglycans">
                  Arterial Wall
                </h2>
              </div>
              <div className="mc-pathway-diagram">
                <ArteryWallNode open={open} onToggle={toggleChip} />
              </div>
            </section>
            <section className="mc-pathway-band" aria-label="Intestine">
              <div className="mc-pathway-site">
                <h2 className="mc-pathway-title" title="Packages dietary fat, absorbed from a meal, into chylomicrons">Intestine</h2>
              </div>
              <div className="mc-pathway-diagram">
                <div className="mc-lipid-intestine">
                  <span data-node="intestine">
                    <Glyph art={INTESTINE_ART} alt="Intestine" />
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <EnterocytesNode />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Byproduct marker, same shape and size as liver-trig and LPL's fatty-acids node -- not yet on Particle1Node (task-0062-followup), though as a GlyphArt-based byproduct it's the cheap half of this pair to convert once that lands. */}
                      {/* Nudges (position: relative + left/top) taken from the debug drag overlay's readout. */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', left: 72, top: 1 }} data-node="enterocyte-trig" title={TRIG_SYNTH_NOTE}>
                        <Glyph art={{ ...TRIGLYCERIDE_ART, size: SIZE.molecular }} alt="Triglyceride" />
                        <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>TRIG</span>
                      </div>
                      {/* A structural-apoprotein marker, same size as liver-apob (ApoB-100) -- both use CarrierIcon, a hand-drawn IconComponent Particle1Node can't render yet (it only wraps a GlyphArt via Glyph). When that's extended, this and liver-apob should share one Particle1 type; 'carrier' already means SHBG/Albumin-style binding carriers on Hormonal Pathways, a different role from a lipoprotein's own structural apoprotein, so land on a distinct type (e.g. 'apoprotein') for both rather than overloading 'carrier'. */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', left: 77, top: 18 }} data-node="enterocyte-apob48" title={APOB48_SYNTH_NOTE}>
                        <CarrierIcon size={SIZE.molecular} />
                        <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>ApoB-48</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ position: 'relative', left: 117, top: -17 }}>
                    <ParticleNode id="chylomicron" label="Chylomicron" holder="ApoB-48" trigCount={4} cholCount={1} trigOverlap={4} />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        <Badges snapshot={snapshot} unitSystem={unitSystem} open={badgeOpen} setOpen={setOpen} setHovered={setHovered} />
        {open === HMGCR && cardAt && <EnzymeCard left={cardAt.left} top={cardAt.top} />}
        {open === RETENTION && cardAt && <RetentionCard left={cardAt.left} top={cardAt.top} />}
      </div>
      {debug && <DebugPanel drags={drags} activeId={activeId} />}
    </div>
  );
}

/** Dev-only readout for the drag-debug toggle above: every dragged node's accumulated offset and its own positioning fields, so a drag can be translated into a CSS fix without guessing. */
function DebugPanel({ drags, activeId }: Readonly<{ drags: Record<string, ReturnType<typeof useNodeDrag>['drags'][string]>; activeId: string | null }>) {
  const ids = Object.keys(drags);
  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        width: 300,
        maxHeight: '55vh',
        overflowY: 'auto',
        background: 'rgba(24,24,24,0.94)',
        color: '#eee',
        fontSize: 11,
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        borderRadius: 8,
        padding: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontWeight: 700 }}>Debug: dragged nodes ({ids.length})</div>
        {ids.length > 0 && (
          <button
            type="button"
            aria-label="Copy"
            onClick={() => {
              const text = ids
                .map((id) => {
                  const d = drags[id];
                  return `${id}\ndx=${d.dx >= 0 ? '+' : ''}${d.dx} dy=${d.dy >= 0 ? '+' : ''}${d.dy}\nleft: ${d.left} · top: ${d.top}\nmarginLeft: ${d.marginLeft} · marginTop: ${d.marginTop}`;
                })
                .join('\n');
              navigator.clipboard?.writeText(text);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontFamily: 'inherit',
              color: '#eee',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            <Copy size={12} />
          </button>
        )}
      </div>
      {ids.length === 0 && <div style={{ opacity: 0.7 }}>Drag any diagram node to see its offset.</div>}
      {ids.map((id) => {
        const d = drags[id];
        return (
          <div
            key={id}
            style={{ marginBottom: 6, padding: 4, borderRadius: 4, background: id === activeId ? 'rgba(255,255,255,0.14)' : 'transparent' }}
          >
            <div>
              {id}
              {id === activeId ? ' (dragging)' : ''}
            </div>
            <div>
              dx={d.dx >= 0 ? '+' : ''}
              {d.dx} dy={d.dy >= 0 ? '+' : ''}
              {d.dy}
            </div>
            <div style={{ opacity: 0.75 }}>
              left: {d.left} · top: {d.top}
            </div>
            <div style={{ opacity: 0.75 }}>
              marginLeft: {d.marginLeft} · marginTop: {d.marginTop}
            </div>
          </div>
        );
      })}
    </div>
  );
}
