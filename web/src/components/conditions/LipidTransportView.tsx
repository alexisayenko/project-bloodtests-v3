import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { PageHeader } from './PageHeader';
import { SegmentedControl } from '../primitives';
import { LIPOPROTEIN_PARTICLES, shareRange, type LipoproteinParticle } from '../../data/lipoproteinParticles';
import { computeIndex, indexBands, indexZone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import { convertConcentration } from '../../data/pathwayReferenceRanges';
import type { Result } from '../../types';
import { fmtNum, isOutOfRange } from '../../utils/format';
import { panelDates, type Observation } from './markers';
import { formatFullDate } from './ui';
import { hasReference, type ResultEntry } from './resultsLookup';
import {
  CARD_WIDTH,
  DASH,
  EMPTY,
  NO_REFERENCE,
  associationFor,
  ringsFor,
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
  type Measure,
  type ReferenceInfo,
} from './pathwayShared';
import { AssociationLayer, ChipValue, Cites, DateStepper, ReferenceBlock, SourcesBlock } from './PathwayParts';
import { ParticleGlyph } from './LipidParticleGlyph';
import { artworkFor } from './lipidArtwork';
import { CompositionSection } from './LipidCompositionSection';

type UnitSystem = 'si' | 'us';

/** The monitoring panel whose results-table dates this page steps through. */
const PANEL_NAME = 'Cardiovascular Risk';

/** Alex's supplied artwork (areas illustrative) or the glyph drawn from the sourced shares. */
const PARTICLE_MODES = ['artwork', 'data'] as const;
type ParticleMode = (typeof PARTICLE_MODES)[number];

const hasSourcedShares = (p: LipoproteinParticle) => Boolean(shareRange(p, 'triglyceride') || shareRange(p, 'cholesterol'));

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

// ---- particle chips ----

interface ChipSpec {
  id: string;
  label: string;
  title: string;
  measure: MarkerSpec | IndexSpec;
  /** The lab's own reading, shown instead of `measure` whenever the draw has one. */
  preferMarker?: MarkerSpec;
  note?: string;
  meaning?: string;
  sources?: readonly CitedSource[];
  /** The particle regions its association rings mark. */
  targets: readonly string[];
}

const PARTICLE_CHIPS: Readonly<Record<string, readonly ChipSpec[]>> = {
  chylomicron: [],
  vldl: [{ id: 'vldl-c', label: 'VLDL-C', title: 'VLDL cholesterol', measure: idx('vldl'), preferMarker: MARKERS.VLDL, targets: ['vldl-chol'] }],
  idl: [],
  ldl: [{ id: 'ldl-c', label: 'LDL-C', title: 'LDL cholesterol', measure: MARKERS.LDL, targets: ['ldl-chol'] }],
  lpa: [{ id: 'lpa-mass', label: 'Lp(a)', title: 'Lipoprotein(a)', measure: MARKERS.LPA, targets: ['lpa-apoa'] }],
  hdl: [
    { id: 'hdl-c', label: 'HDL-C', title: 'HDL cholesterol', measure: MARKERS.HDL, targets: ['hdl-chol'] },
    { id: 'apoa1', label: 'ApoA-I', title: 'Apolipoprotein A-I', measure: MARKERS.APOA1, targets: ['hdl-apo'] },
  ],
};

const regions = (region: string, particles: readonly string[]) => particles.map((p) => `${p}-${region}`);
const ALL_PARTICLES = LIPOPROTEIN_PARTICLES.map((p) => p.id);
const APOB_PILLS = regions('apo', ['vldl', 'idl', 'ldl', 'lpa']);

const APOB_NOTE = 'One ApoB-100 per VLDL, IDL, LDL and Lp(a) particle.';

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

/** Spans the four ApoB-100 particles rather than sitting under one of them. */
const APOB_CHIP: ChipSpec = { id: 'apob-particles', label: 'ApoB', title: 'Apolipoprotein B', measure: MARKERS.APOB, note: APOB_NOTE, meaning: APOB_MEANING, sources: APOB_SOURCES, targets: APOB_PILLS };

const NO_CHIP_NOTE: Readonly<Record<string, string>> = {
  chylomicron: 'No routine measure; adds to TG when not fasting',
  idl: 'No routine measure',
};

function resolveChip(chip: ChipSpec, snapshot: Snapshot): { spec: MarkerSpec | IndexSpec; measure: Measure } {
  if (chip.preferMarker) {
    const measured = snapshot.marker(chip.preferMarker);
    if (measured !== EMPTY) return { spec: chip.preferMarker, measure: measured };
  }
  return { spec: chip.measure, measure: measureOf(chip.measure, snapshot) };
}

const CHIP_BY_ID: Readonly<Record<string, ChipSpec>> = Object.fromEntries(
  [...Object.values(PARTICLE_CHIPS).flat(), APOB_CHIP].map((c) => [c.id, c])
);

function Chip({
  chip,
  snapshot,
  open,
  onToggle,
  setHovered,
}: Readonly<{ chip: ChipSpec; snapshot: Snapshot; open: string | null; onToggle: (id: string, el: HTMLElement) => void; setHovered: (id: string | null) => void }>) {
  const { spec, measure } = resolveChip(chip, snapshot);
  const expanded = open === chip.id;
  return (
    <button
      type="button"
      className={expanded ? 'mc-pathway-chip mc-pathway-chip-open mc-lipid-chip' : 'mc-pathway-chip mc-lipid-chip'}
      data-caption={chip.id}
      aria-expanded={expanded}
      title={chip.note}
      onClick={(e) => onToggle(chip.id, e.currentTarget)}
      onMouseEnter={() => setHovered(chip.id)}
      onMouseLeave={() => setHovered(null)}
      onFocus={() => setHovered(chip.id)}
      onBlur={() => setHovered(null)}
    >
      <span className="mc-pathway-chip-head">
        <span className="mc-pathway-node-label">{chip.label}</span>
        {spec.kind === 'index' && measure !== EMPTY && <CalcTag />}
        <span className={`mc-pathway-dot mc-pathway-dot-${measure.status}`} />
      </span>
      <span className="mc-pathway-node-value">
        <ChipValue measure={measure} />
      </span>
    </button>
  );
}

function ChipCard({ chip, left, top, snapshot, date, unitSystem }: Readonly<{ chip: ChipSpec; left: number; top: number; snapshot: Snapshot; date: string | undefined; unitSystem: UnitSystem }>) {
  const { spec, measure } = resolveChip(chip, snapshot);
  const { info, cites } = withSources(referenceOf(spec, measure, unitSystem), chip.sources);
  const scope = `lipid-${chip.id}`;
  const estimated = chip.preferMarker && spec.kind === 'index' && measure !== EMPTY;
  return (
    <dialog open className="mc-pathway-pop" aria-label={chip.title} style={{ left, top, width: CARD_WIDTH, margin: 0 }}>
      <div className="mc-pathway-pop-title">{chip.title}</div>
      <div className="mc-pathway-pop-facts">
        <span>
          <b>Value</b> {valueText(measure)}
        </span>
        <span>
          <b>Date</b> {date ? formatFullDate(date) : DASH}
        </span>
      </div>
      {chip.meaning && (
        <p className="mc-pathway-pop-note">
          {chip.meaning}
          <Cites scope={scope} cites={cites} />
        </p>
      )}
      {!chip.meaning && chip.note && <p className="mc-pathway-pop-note">{chip.note}</p>}
      {estimated && <p className="mc-pathway-pop-note">Calculated as TG ÷ 5; the lab reported no VLDL-C this draw.</p>}
      <ReferenceBlock scope={scope} info={info} />
      <SourcesBlock scope={scope} info={info} />
    </dialog>
  );
}

// ---- badges ----

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

/** Badge-to-particle association lines, measured from the DOM like Hormonal Pathways' and hidden at rest. */
function LipidAssociations({ root, active, focused, layoutKey }: Readonly<{ root: RefObject<HTMLDivElement | null>; active: string | null; focused: string | null; layoutKey: string }>) {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [veil, setVeil] = useState<{ w: number; h: number } | null>(null);
  useMeasuredLayout(root, layoutKey, (el) => {
    const base = el.getBoundingClientRect();
    const box = el.querySelector('.mc-lipid-particles')?.getBoundingClientRect();
    if (box) setVeil({ w: box.right - base.left, h: box.bottom - base.top });
    // A region with no sourced area in Data mode is not drawn, so its particle's outline is ringed instead.
    const present = (targets: readonly string[]) => [
      ...new Set(targets.map((t) => (el.querySelector(`[data-node="${t}"]`) ? t : t.split('-')[0]))),
    ];
    setAssociations([
      ...BADGES.flatMap((b) => associationFor(el, base, b.id, present(b.targets))),
      ...Object.values(CHIP_BY_ID).map((c) => ({ badge: c.id, paths: [], rings: ringsFor(el, base, present(c.targets)) })),
    ]);
  });
  return (
    <svg className="mc-pathway-overlay" aria-hidden="true">
      <AssociationLayer associations={associations} active={active} focused={focused} veil={veil} />
    </svg>
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
  const [particleMode, setParticleMode] = useState<ParticleMode>('artwork');
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

  const openChip = open ? CHIP_BY_ID[open] : undefined;
  const badgeOpen = openChip ? null : open;
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
        <div className="mc-pathway-check">
          <span aria-hidden="true">Particles</span>
          <SegmentedControl
            label="Particles"
            options={PARTICLE_MODES}
            value={particleMode}
            onChange={setParticleMode}
            format={(mode) => (mode === 'artwork' ? 'Artwork' : 'Data')}
          />
        </div>
      </div>
      <div className="mc-lipid-mode-note">
        {particleMode === 'artwork'
          ? 'Icon fill areas are illustrative; the table below has the sourced shares. Sizes show diameter order, not scale.'
          : 'Yellow and teal areas are the sourced triglyceride and cholesterol mass shares, at the midpoint of the table below; where a share is not sourced, lines ring the whole particle. Sizes show diameter order, not scale.'}
      </div>
      <div className="mc-pathway-layout" ref={layoutRef}>
        <LipidAssociations root={layoutRef} active={hovered ?? badgeOpen} focused={badgeOpen} layoutKey={`${date ?? ''}|${unitSystem}|${particleMode}`} />
        <div className="mc-pathway-main">
          <div className="mc-lipid-particles">
            {LIPOPROTEIN_PARTICLES.map((p) => (
              <figure key={p.id} className="mc-lipid-particle">
                <div className="mc-lipid-glyph">
                  {particleMode === 'artwork' ? (
                    <span className="mc-lipid-art" dangerouslySetInnerHTML={{ __html: artworkFor(p.id, p.name) }} />
                  ) : (
                    <ParticleGlyph particle={p} />
                  )}
                </div>
                <figcaption className="mc-lipid-name">{p.name}</figcaption>
                {particleMode === 'data' && !hasSourcedShares(p) && <span className="mc-lipid-none">composition not sourced</span>}
                <div className="mc-lipid-chips">
                  {(PARTICLE_CHIPS[p.id] ?? []).map((chip) => (
                    <Chip key={chip.id} chip={chip} snapshot={snapshot} open={open} onToggle={toggleChip} setHovered={setHovered} />
                  ))}
                  {NO_CHIP_NOTE[p.id] && <span className="mc-lipid-none">{NO_CHIP_NOTE[p.id]}</span>}
                </div>
              </figure>
            ))}
            <div className="mc-lipid-apob" title={APOB_NOTE}>
              <span className="mc-lipid-brace" aria-hidden="true" />
              <Chip chip={APOB_CHIP} snapshot={snapshot} open={open} onToggle={toggleChip} setHovered={setHovered} />
            </div>
          </div>
        </div>
        <Badges snapshot={snapshot} unitSystem={unitSystem} open={badgeOpen} setOpen={setOpen} setHovered={setHovered} />
        {openChip && cardAt && <ChipCard chip={openChip} left={cardAt.left} top={cardAt.top} snapshot={snapshot} date={date} unitSystem={unitSystem} />}
      </div>
      <CompositionSection />
    </div>
  );
}
