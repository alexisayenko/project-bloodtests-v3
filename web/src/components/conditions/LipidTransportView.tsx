import { useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { PageHeader } from './PageHeader';
import { CarrierIcon, CholesterolIcon, FattyAcidIcon, TriglycerideIcon, type IconComponent } from './customIcons';
import { SegmentedControl } from '../primitives';
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
          <span data-node="reductase-bubble">
            <Glyph art={ENZYME_ART} />
          </span>
          <span className="mc-pathway-node-label">HMG-CoA reductase</span>
        </button>
        <span className="mc-lipid-synth-chol" data-node="synth-chol">
          <CholesterolIcon size={STANDALONE_CHOL_ICON_SIZE} />
        </span>
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
  useMeasuredLayout(root, layoutKey, (el) => {
    const base = el.getBoundingClientRect();
    const organ = el.querySelector('.mc-lipid-organ')?.getBoundingClientRect();
    const vldl = el.querySelector('[data-node="vldl"]')?.getBoundingClientRect();
    setSecretion(
      organ && vldl ? `M${vldl.left + vldl.width / 2 - base.left},${organ.bottom - base.top + 2} L${vldl.left + vldl.width / 2 - base.left},${vldl.top - base.top - 4}` : null
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
    // VLDL's separate fate for its shed triglyceride: a path down to LPL's own bubble, then on to the fatty-acid glyph -- one continuous arrow, kept apart from the LDL-uptake one above.
    const lplBubble = el.querySelector('[data-node="lpl-bubble"]')?.getBoundingClientRect();
    const fattyAcids = el.querySelector('[data-node="fatty-acids"]')?.getBoundingClientRect();
    setLplArrow(
      vldl && lplBubble && fattyAcids
        ? `M${vldl.left - base.left + 20},${vldl.bottom - base.top + 2} L${lplBubble.left + lplBubble.width / 2 - base.left},${lplBubble.top - base.top - 4} M${lplBubble.right - base.left + 2},${lplBubble.top + lplBubble.height / 2 - base.top} L${fattyAcids.left - base.left - 2},${fattyAcids.top + fattyAcids.height / 2 - base.top}`
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
      {enterocyteTrigArrow && <path d={enterocyteTrigArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {enterocyteApoB48Arrow && <path d={enterocyteApoB48Arrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
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

/** ApoB-100's own drawing spans ~42.6 of its 48-unit viewBox (HormonalPathwaysView's CARRIER_SIZE), so its box is enlarged to bring the drawing itself to molecular-actor size. */
const CARGO_APO_SIZE = Math.round((SIZE.molecular * 48) / 42.6);
const CARGO_BUBBLE_SIZE = SIZE.molecular;
/** The bare cholesterol icon by the liver has no bubble to fill, so it reads at a bigger, more visible size than the docked one -- roomier than a bare signal molecule on Hormonal Pathways (SIZE.molecular). */
const STANDALONE_CHOL_ICON_SIZE = Math.round(SIZE.molecular * 1.35);
/**
 * Every bond line in this chain (TRIG-ApoB and Chol-ApoB) is tuned to the
 * same ~75px length, so the chain reads as one consistent unit of "distance
 * a bond spans" rather than particle-specific line lengths.
 */
/** How far ApoB-100 drops below TRIG/Chol, so the two bonds meet it at a sharp angle. IDL/LDL drop the same amount to line up with it, since they're the same particle further down the chain. */
const VLDL_APO_DROP = 160;
/** TRIG and Chol also drop partway down their own bond lines, toward ApoB-100, so the V reads as a shorter, tighter shape rather than spanning the full height. Tuned together with VLDL_CARGO_GAP for a ~75px bond length. */
const VLDL_CARGO_DROP = 51;
/** Horizontal gap either side of ApoB-100, tuned together with VLDL_CARGO_DROP. */
const VLDL_CARGO_GAP = 4;
/**
 * Circle size for each compound's individual unit-bubble in a stack (below) --
 * the same 32px diameter as `CARGO_BUBBLE_SIZE` and as `BUBBLE_SIZE`
 * (`SIZE.molecular`) on Hormonal Pathways' own docked bubbles, so a bubble
 * reads as the same size everywhere it appears on either page.
 */
const STACK_TRIG_CIRCLE_SIZE = CARGO_BUBBLE_SIZE;
const STACK_CHOL_CIRCLE_SIZE = CARGO_BUBBLE_SIZE;
/** Scaled up from Hormonal Pathways' DOCKED_SIZE (21, sized for a 25px stack circle) to keep the same fill ratio now the circle itself is bigger (32px, matching Hormonal Pathways' own bubble diameter). */
const STACK_TRIG_ICON_SIZE = 27;
/** The cholesterol glyph's own drawing reads smaller than TRIG's at the same size, so its icon runs bigger than its own circle to fill it as fully -- scaled up together with STACK_CHOL_CIRCLE_SIZE to keep the same proportion. */
const STACK_CHOL_ICON_SIZE = 34;
/**
 * TRIG: 3 for VLDL, 2 for IDL (shed via lipoprotein lipase), 1 for LDL
 * (essentially none left), 4 for chylomicron (the fattiest particle). Chol:
 * 3 for VLDL, 2 for IDL, 1 for LDL/chylomicron/HDL/Lp(a). Illustrative
 * counts, not to scale: the sourced data (lipoprotein-particles.json) only
 * gives % of each particle's own mass, and IDL's isn't sourced at all.
 */

/** A cargo diagram's own anchor: an icon (or docked bubble) with a caption below it, sized to line up with the apoprotein's own height. `labelOffset` nudges the caption sideways (px, positive = right) when the bond geometry leaves it looking off-center. */
function CargoAnchor({ children, label, labelOffset = 0 }: Readonly<{ children: ReactNode; label: string; labelOffset?: number }>) {
  return (
    <div className="mc-pathway-anchor" style={{ height: CARGO_APO_SIZE, alignItems: 'center' }}>
      {children}
      <div className="mc-pathway-caption" style={labelOffset ? { transform: `translateX(calc(-50% + ${labelOffset}px))` } : undefined}>
        <span className="mc-pathway-node-label">{label}</span>
      </div>
    </div>
  );
}

/** A vertical stack of identical small bubbles: how many circles is how much of that compound is aboard, not one bigger blob -- a discrete count rather than a scaled size, so "more" never looks like "bigger". */
function CompoundStack({
  dataNode,
  count,
  circleSize,
  iconSize,
  icon: Icon,
  label,
  labelOffset = 0,
  overlap = 0,
}: Readonly<{
  dataNode: string;
  count: number;
  circleSize: number;
  iconSize: number;
  icon: IconComponent;
  label: string;
  labelOffset?: number;
  /** When set (px), circles cascade diagonally and partly cover each other instead of stacking edge to edge. */
  overlap?: number;
}>) {
  const cascadeSpan = overlap * (count - 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        data-node={dataNode}
        style={
          overlap
            ? { position: 'relative', width: circleSize + cascadeSpan, height: circleSize + cascadeSpan }
            : { display: 'flex', flexDirection: 'column', gap: 3 }
        }
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="mc-pathway-bubble"
            style={
              overlap
                ? { position: 'absolute', left: i * overlap, top: i * overlap, width: circleSize, height: circleSize, zIndex: i }
                : { width: circleSize, height: circleSize }
            }
          >
            <Icon size={iconSize} />
          </span>
        ))}
      </div>
      <span className="mc-pathway-node-label" style={{ marginTop: 6, display: 'inline-block', transform: labelOffset ? `translateX(${labelOffset}px)` : undefined }}>
        {label}
      </span>
    </div>
  );
}

// ---- lipoprotein chain ----

/**
 * One stage of the endogenous chain, drawn as a holder-plus-cargo row:
 * the holder apoprotein carries its own stack of Chol circles and a stack
 * of TRIG circles, bonded to it at the same sharp angle VLDL uses. Every
 * particle rendered here still carries at least one TRIG circle (down to 1
 * for LDL/HDL/Lp(a)), so there is no bare-Chol-only variant to draw.
 */
function ParticleNode({
  id,
  label,
  holder = 'ApoB-100',
  extraApo,
  trigCount,
  cholCount,
  trigOverlap = 0,
}: Readonly<{
  id: string;
  label: string;
  /** The particle's structural apolipoprotein -- ApoB-100 for the endogenous chain, ApoB-48 for chylomicron, ApoA-I for HDL. */
  holder?: string;
  /** Lp(a) carries a second protein, apo(a), disulfide-linked to its ApoB-100 -- drawn as a small pill hanging off the holder icon. */
  extraApo?: string;
  /** At least 1 for every particle rendered here -- see the note above ParticleNode. */
  trigCount: number;
  cholCount: number;
  trigOverlap?: number;
}>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node={id}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ marginTop: VLDL_CARGO_DROP }}>
          <CompoundStack
            dataNode={`${id}-trig`}
            count={trigCount}
            circleSize={STACK_TRIG_CIRCLE_SIZE}
            iconSize={STACK_TRIG_ICON_SIZE}
            icon={TriglycerideIcon}
            label="TRIG"
            labelOffset={-5}
            overlap={trigOverlap}
          />
        </div>
        <span style={{ width: VLDL_CARGO_GAP }} />
        <div style={{ marginTop: VLDL_APO_DROP }}>
          <CargoAnchor label={holder}>
            <span data-node={`${id}-apo`} style={extraApo ? { position: 'relative' } : undefined}>
              <CarrierIcon size={CARGO_APO_SIZE} />
              {extraApo && (
                <span className="mc-lipid-extra-apo" title={extraApo}>
                  <CarrierIcon size={Math.round(CARGO_APO_SIZE * 0.55)} />
                  <span className="mc-lipid-extra-apo-label">(a)</span>
                </span>
              )}
            </span>
          </CargoAnchor>
        </div>
        <span style={{ width: VLDL_CARGO_GAP }} />
        <div style={{ marginTop: VLDL_CARGO_DROP }}>
          <CompoundStack
            dataNode={`${id}-chol`}
            count={cholCount}
            circleSize={STACK_CHOL_CIRCLE_SIZE}
            iconSize={STACK_CHOL_ICON_SIZE}
            icon={CholesterolIcon}
            label="Chol"
            labelOffset={5}
            overlap={4}
          />
        </div>
      </div>
      <span className="mc-pathway-node-label" style={{ marginTop: 8 }}>{label}</span>
    </div>
  );
}

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
 * `FattyAcidIcon`, a single carbon-chain tail (not `TriglycerideIcon`'s
 * three), since LPL releases individual fatty acids rather than whole
 * triglycerides. Muscle and Adipocytes reuse the same generic cell artwork as
 * Peripheral cells and Enterocytes (`CELLS_ART`), for the same reason: no
 * tissue-specific artwork exists yet.
 */
const LPL_NOTE = 'Lipoprotein lipase';
const LPL_ARROW_NOTE = "Lipoprotein lipase releases fatty acids from VLDL's triglycerides for muscle energy and fat storage";
const FATTY_ACID_ICON_SIZE = 20;

function CellDestination({ label }: Readonly<{ label: string }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Glyph art={CELLS_ART} />
      <span className="mc-pathway-node-label" style={{ marginTop: 8 }}>{label}</span>
    </div>
  );
}

function LplBranch() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 36 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={LPL_NOTE}>
        <span data-node="lpl-bubble">
          <Glyph art={ENZYME_ART} />
        </span>
        <span className="mc-pathway-node-label">LPL</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} data-node="fatty-acids" title={LPL_ARROW_NOTE}>
        <FattyAcidIcon size={FATTY_ACID_ICON_SIZE} />
        <FattyAcidIcon size={FATTY_ACID_ICON_SIZE} />
        <FattyAcidIcon size={FATTY_ACID_ICON_SIZE} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <CellDestination label="Muscle" />
        <CellDestination label="Adipocytes" />
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

  const badgeOpen = open === HMGCR ? null : open;
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
      </div>
      <ArtworkNote>The liver image is illustrative.</ArtworkNote>
      <div className="mc-pathway-layout" ref={layoutRef}>
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={VLDL_FATTY_ACID_SUPPLY_NOTE}>
                    <FattyAcidIcon size={16} />
                    <span className="mc-pathway-node-label" style={{ fontSize: 10 }}>fatty acids</span>
                    <div style={{ borderLeft: '1.5px dashed var(--navy)', height: 16 }} />
                  </div>
                  <div title={VLDL_ASSEMBLY_NOTE}>
                    <ParticleNode id="vldl-construction" label="Nascent VLDL" trigCount={3} cholCount={3} />
                  </div>
                </div>
              </div>
            </section>
            <section className="mc-pathway-band" aria-label="Blood Transport">
              <div className="mc-pathway-site">
                <h2 className="mc-pathway-title" title="VLDL sheds triglyceride and becomes IDL, then LDL">Blood Transport</h2>
              </div>
              <div className="mc-pathway-diagram">
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
            <section className="mc-pathway-band" aria-label="Intestine">
              <div className="mc-pathway-site">
                <h2 className="mc-pathway-title" title="Packages dietary fat, absorbed from a meal, into chylomicrons">Intestine</h2>
              </div>
              <div className="mc-pathway-diagram">
                <div className="mc-lipid-intestine">
                  <span data-node="intestine">
                    <Glyph art={INTESTINE_ART} alt="Intestine" />
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node="enterocyte-trig" title={TRIG_SYNTH_NOTE}>
                        <TriglycerideIcon size={STANDALONE_CHOL_ICON_SIZE} />
                        <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>TRIG</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node="enterocyte-apob48" title={APOB48_SYNTH_NOTE}>
                        <CarrierIcon size={STANDALONE_CHOL_ICON_SIZE} />
                        <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>ApoB-48</span>
                      </div>
                    </div>
                    <EnterocytesNode />
                  </div>
                  <ParticleNode id="chylomicron" label="Chylomicron" holder="ApoB-48" trigCount={4} cholCount={1} trigOverlap={4} />
                </div>
              </div>
            </section>
          </div>
        </div>
        <Badges snapshot={snapshot} unitSystem={unitSystem} open={badgeOpen} setOpen={setOpen} setHovered={setHovered} />
        {open === HMGCR && cardAt && <EnzymeCard left={cardAt.left} top={cardAt.top} />}
      </div>
    </div>
  );
}
