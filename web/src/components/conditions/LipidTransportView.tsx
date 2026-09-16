import { useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { PageHeader } from './PageHeader';
import { CarrierIcon, CholesterolIcon, TriglycerideIcon } from './customIcons';
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
import { CompositionSection } from './LipidCompositionSection';

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

// ---- liver ----

const HMGCR = 'hmgcr';
const HMGCR_NOTE = 'Rate-limiting enzyme of cholesterol synthesis; the target of statins.';

/** Liver silhouette, cropped to its non-transparent bounding box the way BRAIN_ART is (HormonalPathwaysView.tsx). */
const LIVER_ART: GlyphArt = { src: '/pathways/liver.png?v=1', width: 256, height: 176, box: [4, 4, 252, 172], size: SIZE.organ };

/** HMG-CoA reductase docks on the liver the way a bound-hormone bubble docks on a carrier: a white circle behind the icon so it reads over the artwork. */
const HMGCR_DOCK_SIZE = Math.round(SIZE.molecular * 1.5);

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
          <span className="mc-pathway-bubble" style={{ width: HMGCR_DOCK_SIZE, height: HMGCR_DOCK_SIZE }}>
            <Glyph art={ENZYME_ART} />
          </span>
          <span className="mc-pathway-node-label">HMG-CoA reductase</span>
        </button>
        <span className="mc-lipid-synth-chol">
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
function LipidAssociations({ root, active, focused, layoutKey }: Readonly<{ root: RefObject<HTMLDivElement | null>; active: string | null; focused: string | null; layoutKey: string }>) {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [veil, setVeil] = useState<{ w: number; h: number } | null>(null);
  const [secretion, setSecretion] = useState<string | null>(null);
  const [vldlBond, setVldlBond] = useState<string | null>(null);
  useMeasuredLayout(root, layoutKey, (el) => {
    const base = el.getBoundingClientRect();
    const organ = el.querySelector('.mc-lipid-organ')?.getBoundingClientRect();
    const vldl = el.querySelector('[data-node="vldl"]')?.getBoundingClientRect();
    setSecretion(
      organ && vldl ? `M${vldl.left + vldl.width / 2 - base.left},${organ.bottom - base.top + 2} L${vldl.left + vldl.width / 2 - base.left},${vldl.top - base.top - 4}` : null
    );
    const trig = el.querySelector('[data-node="vldl-trig"]')?.getBoundingClientRect();
    const apo = el.querySelector('[data-node="vldl-apo"]')?.getBoundingClientRect();
    const chol = el.querySelector('[data-node="vldl-chol"]')?.getBoundingClientRect();
    setVldlBond(
      trig && apo && chol
        ? (() => {
            const center = (r: DOMRect) => ({ x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top });
            const t = center(trig);
            const c = center(chol);
            const a = center(apo);
            // Pull each end back along the center-to-center line by that node's own radius, so the bond meets the circle radially (perpendicular to its edge) instead of at a fixed side point.
            const onEdge = (from: { x: number; y: number }, to: { x: number; y: number }, radius: number) => {
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const dist = Math.hypot(dx, dy);
              return { x: from.x + (dx / dist) * radius, y: from.y + (dy / dist) * radius };
            };
            const apoRadius = apo.width / 2 + 3;
            const trigEdge = onEdge(t, a, trig.width / 2 + 2);
            const cholEdge = onEdge(c, a, chol.width / 2 + 2);
            const apoFromT = onEdge(a, t, apoRadius);
            const apoFromC = onEdge(a, c, apoRadius);
            return `M${trigEdge.x},${trigEdge.y} L${apoFromT.x},${apoFromT.y} M${cholEdge.x},${cholEdge.y} L${apoFromC.x},${apoFromC.y}`;
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
      {vldlBond && <path d={vldlBond} fill="none" stroke="var(--navy)" strokeWidth={1.5} />}
      <AssociationLayer associations={associations} active={active} focused={focused} veil={veil} />
    </svg>
  );
}

// ---- cargo diagram ----

/** ApoB-100's own drawing spans ~42.6 of its 48-unit viewBox (HormonalPathwaysView's CARRIER_SIZE), so its box is enlarged to bring the drawing itself to molecular-actor size. */
const CARGO_APO_SIZE = Math.round((SIZE.molecular * 48) / 42.6);
const CARGO_BUBBLE_SIZE = SIZE.molecular;
const CARGO_ICON_SIZE = Math.round(CARGO_BUBBLE_SIZE * 0.85);
/** The cholesterol icon reads clearer bigger than TRIG's, so its bubble grows a
 * little to hold a bigger icon -- the icon itself grows more than the bubble
 * does, so it fills more of its dock rather than just scaling uniformly. */
const CARGO_CHOL_BUBBLE_SIZE = Math.round(CARGO_BUBBLE_SIZE * 1.15);
const CARGO_CHOL_ICON_SIZE = Math.round(CARGO_BUBBLE_SIZE * 1.05);
/** The bare cholesterol icon by the liver has no bubble to fill, so it reads at a bigger, more visible size than the docked one -- roomier than a bare signal molecule on Hormonal Pathways (SIZE.molecular). */
const STANDALONE_CHOL_ICON_SIZE = Math.round(SIZE.molecular * 1.35);
/** How far ApoB-100 drops below TRIG/Chol, so the two bonds meet it at a sharp ~60 degree angle. IDL/LDL drop the same amount to line up with it, since they're the same particle further down the chain. */
const VLDL_APO_DROP = 160;
/** TRIG and Chol also drop partway down their own bond lines, toward ApoB-100, so the V reads as a shorter, tighter shape rather than spanning the full height. Tuned together with VLDL_CARGO_GAP for a ~60 degree vertex angle at a fixed bond length. */
const VLDL_CARGO_DROP = 28;
/** Horizontal gap either side of ApoB-100, tuned together with VLDL_CARGO_DROP. */
const VLDL_CARGO_GAP = 4;

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

// ---- lipoprotein chain ----

/** A node in the IDL/LDL part of the chain, the same circle-icon-plus-caption node the cargo diagram uses for TRIG/ApoB-100/Chol. */
function ChainAnchor({ id, label }: Readonly<{ id: string; label: string }>) {
  return (
    <CargoAnchor label={label}>
      <span className="mc-pathway-bubble mc-lipid-chain-node" style={{ width: CARGO_BUBBLE_SIZE, height: CARGO_BUBBLE_SIZE }} data-node={id}>
        <CarrierIcon size={CARGO_ICON_SIZE} />
      </span>
    </CargoAnchor>
  );
}

/**
 * VLDL is drawn as the same TRIG/ApoB-100/Chol holder-plus-cargo row the
 * cargo diagram above uses -- it's the same particle, so it gets the same
 * picture, grouped under one "VLDL" label rather than a new, smaller glyph.
 */
function VldlNode() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node="vldl">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ marginTop: VLDL_CARGO_DROP }}>
          <CargoAnchor label="TRIG" labelOffset={-5}>
            <span className="mc-pathway-bubble" data-node="vldl-trig" style={{ width: CARGO_BUBBLE_SIZE, height: CARGO_BUBBLE_SIZE }}>
              <TriglycerideIcon size={CARGO_ICON_SIZE} />
            </span>
          </CargoAnchor>
        </div>
        <span style={{ width: VLDL_CARGO_GAP }} />
        <div style={{ marginTop: VLDL_APO_DROP }}>
          <CargoAnchor label="ApoB-100">
            <span data-node="vldl-apo">
              <CarrierIcon size={CARGO_APO_SIZE} />
            </span>
          </CargoAnchor>
        </div>
        <span style={{ width: VLDL_CARGO_GAP }} />
        <div style={{ marginTop: VLDL_CARGO_DROP }}>
          <CargoAnchor label="Chol" labelOffset={5}>
            <span className="mc-pathway-bubble" data-node="vldl-chol" style={{ width: CARGO_CHOL_BUBBLE_SIZE, height: CARGO_CHOL_BUBBLE_SIZE }}>
              <CholesterolIcon size={CARGO_CHOL_ICON_SIZE} />
            </span>
          </CargoAnchor>
        </div>
      </div>
      <span className="mc-pathway-node-label">VLDL</span>
    </div>
  );
}

/**
 * The endogenous lipoprotein pathway: the liver's secreted VLDL loses
 * triglyceride and becomes IDL, then LDL -- one ApoB-100 particle
 * transforming, not three separate ones.
 */
function LipoproteinChain() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, paddingBottom: 26 }}>
      <VldlNode />
      <div style={{ display: 'flex', gap: 28, marginTop: VLDL_APO_DROP }}>
        <ChainAnchor id="idl" label="IDL" />
        <ChainAnchor id="ldl" label="LDL" />
      </div>
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
              </div>
            </section>
            <section className="mc-pathway-band" aria-label="Blood Transport">
              <div className="mc-pathway-site">
                <h2 className="mc-pathway-title" title="VLDL sheds triglyceride and becomes IDL, then LDL">Blood Transport</h2>
              </div>
              <div className="mc-pathway-diagram">
                <LipoproteinChain />
              </div>
            </section>
          </div>
        </div>
        <Badges snapshot={snapshot} unitSystem={unitSystem} open={badgeOpen} setOpen={setOpen} setHovered={setHovered} />
        {open === HMGCR && cardAt && <EnzymeCard left={cardAt.left} top={cardAt.top} />}
      </div>
      <CompositionSection />
    </div>
  );
}
