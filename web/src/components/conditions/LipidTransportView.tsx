import { useCallback, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Copy } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { CarrierIcon, CholesterolIcon } from './customIcons';
import { ParticleNode } from './Particle3';
import { computeIndex, indexBands, indexZone } from '../../data/computedIndices';
import { convertConcentration } from '../../data/pathwayReferenceRanges';
import type { Result, UnitSystem } from '../../types';
import { displayUnitOf, fmtNum, isOutOfRange } from '../../utils/format';
import type { Observation } from './markers';
import { hasReference, type ResultEntry } from './resultsLookup';
import {
  CARD_WIDTH,
  ENZYME_ART,
  SIZE,
  TRIGLYCERIDE_ART,
  EMPTY,
  NO_REFERENCE,
  associationFor,
  combinedZones,
  indexDefOf,
  keepSources,
  labReference,
  mergeReferences,
  useAxisPage,
  useMeasuredLayout,
  useNodeDrag,
  valueText,
  zoneReference,
  type Association,
  type CitedSource,
  type GlyphArt,
  type Measure,
  type ReferenceInfo,
} from './pathwayShared';
import { ArtworkNote, AssociationLayer, AxisToolbar, BadgeColumn, Cites, Glyph, ReferenceBlock, SourcesBlock } from './PathwayParts';
import {
  chainHopArrows,
  computeRetentionArrows,
  edgeToEdgeArrow,
  faSupplyArrowPath,
  ldlUptakeArrow,
  liverToApobArrowPath,
  liverToTrigArrowPath,
  lplArrowPath,
  particleBondsAndOutlines,
  presentTargets,
  type Arrow,
  type Outline,
} from './LipidTransport.geometry';
import {
  BADGES,
  CHOLESTEROL_UNITS,
  HMGCR,
  HMGCR_NOTE,
  HMGCR_SOURCES,
  RETENTION,
  RETENTION_NOTE,
  RETENTION_SOURCES,
  idx,
  type BadgeSpec,
  type IndexSpec,
  type MarkerSpec,
  type MethodsSpec,
} from './LipidTransport.badges';

/** The monitoring panel whose results-table dates this page steps through. */
const PANEL_NAME = 'Cardiovascular Risk';

// ---- measures ----

/** A computed index in mg/dL of cholesterol is shown on the same scale as the lab's cholesterol readings. */
function indexDisplay(key: string) {
  return indexDefOf(key)?.unit === 'mg/dL' ? CHOLESTEROL_UNITS : undefined;
}

/** `label` names an unconverted number's unit (the stored unit); the conversion itself reads the printed `unit`. */
function place(
  value: number,
  unit: string,
  display: MarkerSpec['display'],
  unitSystem: UnitSystem,
  label = unit
): { value: number; unit: string } {
  const to = display?.[unitSystem];
  const converted = to ? convertConcentration(value, unit, to, display?.molarMass) : undefined;
  return converted === undefined || !to ? { value, unit: label } : { value: converted, unit: to };
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
      const hit = onDate.find((e) => spec.loincs.includes(e.loinc));
      if (hit?.result.value == null) return EMPTY;
      const unit = hit.result.unit ?? '';
      const label = displayUnitOf(hit.result);
      const shown = place(hit.result.value, unit, spec.display, unitSystem, label);
      if (!hasReference(hit.result)) return { text: quantityText(shown), unit: shown.unit, status: 'none' };
      const bound = (v: number | null) => (v == null ? undefined : place(v, unit, spec.display, unitSystem, label));
      const low = bound(hit.result.refMin);
      const high = bound(hit.result.refMax);
      return {
        text: quantityText(shown),
        unit: shown.unit,
        lab: { low: low?.value, high: high?.value, unit: (low ?? high)?.unit ?? label },
        status: isOutOfRange(hit.result) ? 'bad' : 'ok',
      };
    },
    index: (key) => {
      const def = indexDefOf(key);
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
  const def = indexDefOf(spec.key);
  if (!def) return NO_REFERENCE;
  return zoneReference(def, indexBands(def), (cut) => place(cut, def.unit ?? '', indexDisplay(spec.key), unitSystem));
}

function CalcTag() {
  return <span className="mc-lipid-calc">calc</span>;
}

// ---- badges ----

/** A block's own citations followed by the spec's, and the numbers the spec's take in that list. */
function withSources(info: ReferenceInfo, sources: readonly CitedSource[] = []): { info: ReferenceInfo; cites: number[] } {
  return { info: { ...info, sources: [...info.sources, ...sources] }, cites: sources.map((_, i) => info.sources.length + i + 1) };
}

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

function BadgeBody({ badge, scope, snapshot, unitSystem }: Readonly<{ badge: BadgeSpec; scope: string; snapshot: Snapshot; unitSystem: UnitSystem }>) {
  if (badge.methods) return <MethodsBody badge={badge} methods={badge.methods} snapshot={snapshot} unitSystem={unitSystem} />;
  const { measure } = badgeFace(badge, snapshot);
  const cited = withSources(referenceOf(badge.measure, measure, unitSystem), badge.sources);
  return (
    <div className="mc-pathway-badge-body">
      <ReferenceBlock scope={scope} info={cited.info} />
      <span>
        <b>Meaning</b> {badge.meaning}
        <Cites scope={scope} cites={cited.cites} />
      </span>
      <SourcesBlock scope={scope} info={cited.info} />
    </div>
  );
}

// ---- intestine ----

const INTESTINE_ART: GlyphArt = { src: '/pathways/intestine.png?v=1', width: 237, height: 256, box: [5, 5, 232, 251], size: SIZE.organ };

// ---- liver ----

const LIVER_ART: GlyphArt = { src: '/pathways/liver.png?v=1', width: 256, height: 176, box: [4, 4, 252, 172], size: SIZE.organ };

const VLDL_ASSEMBLY_NOTE = "The liver assembles VLDL from triglyceride, cholesterol and ApoB-100 before secreting it into blood.";
const VLDL_FATTY_ACID_SUPPLY_NOTE = 'Fatty acids the liver imports from blood (adipose lipolysis, chylomicron remnants) rather than makes itself, feeding VLDL triglyceride synthesis.';
/** A plain descriptive tooltip, not a footnoted claim. */
const LIVER_TRIG_SYNTH_NOTE = 'The liver esterifies fatty acids into triglyceride (DGAT, via the glycerol-3-phosphate pathway)';

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
          <CarrierIcon size={SIZE.molecular} />
          <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>ApoB-100</span>
        </div>
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

function LipidAssociations({ root, active, focused, layoutKey }: Readonly<{ root: RefObject<HTMLDivElement | null>; active: string | null; focused: string | null; layoutKey: string }>) {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [veil, setVeil] = useState<{ w: number; h: number } | null>(null);
  const [secretion, setSecretion] = useState<string | null>(null);
  const [ldlUptake, setLdlUptake] = useState<string | null>(null);
  const [chainArrows, setChainArrows] = useState<Arrow[]>([]);
  const [lplArrow, setLplArrow] = useState<string | null>(null);
  const [particleBonds, setParticleBonds] = useState<Arrow[]>([]);
  const [particleOutlines, setParticleOutlines] = useState<Outline[]>([]);
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
  const [retentionArrows, setRetentionArrows] = useState<Arrow[]>([]);
  useMeasuredLayout(root, layoutKey, (el) => {
    const base = el.getBoundingClientRect();
    const vldl = el.querySelector('[data-node="vldl"]')?.getBoundingClientRect();
    const nascentVldl = el.querySelector('[data-node="vldl-construction"]')?.getBoundingClientRect();
    setSecretion(edgeToEdgeArrow(nascentVldl, vldl, base, 3, 5, 'height'));
    const idl = el.querySelector('[data-node="idl"]')?.getBoundingClientRect();
    const ldl = el.querySelector('[data-node="ldl"]')?.getBoundingClientRect();
    const targetCells = el.querySelector('[data-node="target-cells"]')?.getBoundingClientRect();
    const vldlApo = el.querySelector('[data-node="vldl-apo"]')?.getBoundingClientRect();
    const idlApo = el.querySelector('[data-node="idl-apo"]')?.getBoundingClientRect();
    const ldlApo = el.querySelector('[data-node="ldl-apo"]')?.getBoundingClientRect();
    setLdlUptake(ldlUptakeArrow(ldl, targetCells, ldlApo, base));
    setChainArrows(chainHopArrows(vldl, idl, ldl, vldlApo, idlApo, base));
    const lpaApo = el.querySelector('[data-node="lpa-apo"]')?.getBoundingClientRect();
    const arteryGap = el.querySelector(`[data-node="${ARTERY_GAP}"]`)?.getBoundingClientRect();
    setRetentionArrows(computeRetentionArrows(idlApo, ldlApo, lpaApo, arteryGap, base));
    const lplBubble = el.querySelector('[data-node="lpl-bubble"]')?.getBoundingClientRect();
    const fattyAcids = el.querySelector('[data-node="fatty-acids"]')?.getBoundingClientRect();
    const lplMuscle = el.querySelector('[data-node="lpl-muscle"]')?.getBoundingClientRect();
    const lplAdipocytes = el.querySelector('[data-node="lpl-adipocytes"]')?.getBoundingClientRect();
    setLplArrow(lplArrowPath(vldl, lplBubble, fattyAcids, lplMuscle, lplAdipocytes, base));
    const { bonds, outlines } = particleBondsAndOutlines(el, base);
    setParticleBonds(bonds);
    setParticleOutlines(outlines);
    const reductase = el.querySelector('[data-node="reductase-bubble"]')?.getBoundingClientRect();
    const synthChol = el.querySelector('[data-node="synth-chol"]')?.getBoundingClientRect();
    setSynthArrow(edgeToEdgeArrow(reductase, synthChol, base));
    const vldlConstructionChol = el.querySelector('[data-node="vldl-construction-chol"]')?.getBoundingClientRect();
    setCholToVldlArrow(edgeToEdgeArrow(synthChol, vldlConstructionChol, base));
    const vldlConstructionTrig = el.querySelector('[data-node="vldl-construction-trig"]')?.getBoundingClientRect();
    const vldlConstructionApo = el.querySelector('[data-node="vldl-construction-apo"]')?.getBoundingClientRect();
    const liverTrig = el.querySelector('[data-node="liver-trig"]')?.getBoundingClientRect();
    const liverApob = el.querySelector('[data-node="liver-apob"]')?.getBoundingClientRect();
    setLiverTrigArrow(edgeToEdgeArrow(liverTrig, vldlConstructionTrig, base));
    setApoB100Arrow(edgeToEdgeArrow(liverApob, vldlConstructionApo, base));
    const faSupply = el.querySelector('[data-node="fa-supply"]')?.getBoundingClientRect();
    const liverOrgan = el.querySelector('[data-node="liver"]')?.getBoundingClientRect();
    setFaSupplyArrow(faSupplyArrowPath(faSupply, liverOrgan, base));
    setLiverToTrigArrow(liverToTrigArrowPath(liverOrgan, liverTrig, base));
    setLiverToApobArrow(liverToApobArrowPath(liverOrgan, liverApob, base));
    const enterocytes = el.querySelector('[data-node="enterocytes"]')?.getBoundingClientRect();
    const enterocyteTrig = el.querySelector('[data-node="enterocyte-trig"]')?.getBoundingClientRect();
    const enterocyteApoB48 = el.querySelector('[data-node="enterocyte-apob48"]')?.getBoundingClientRect();
    setEnterocyteTrigArrow(edgeToEdgeArrow(enterocytes, enterocyteTrig, base));
    setEnterocyteApoB48Arrow(edgeToEdgeArrow(enterocytes, enterocyteApoB48, base));
    const chylomicronTrig = el.querySelector('[data-node="chylomicron-trig"]')?.getBoundingClientRect();
    const chylomicronApo = el.querySelector('[data-node="chylomicron-apo"]')?.getBoundingClientRect();
    setTrigToChylomicronArrow(edgeToEdgeArrow(enterocyteTrig, chylomicronTrig, base));
    setApoB48ToChylomicronArrow(edgeToEdgeArrow(enterocyteApoB48, chylomicronApo, base));
    const box = el.querySelector('.mc-lipid-particles')?.getBoundingClientRect();
    if (box) setVeil({ w: box.right - base.left, h: box.bottom - base.top });
    setAssociations(BADGES.flatMap((b) => associationFor(el, base, b.id, presentTargets(el, b.targets))));
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
      {chainArrows.map((c) => (
        <path key={c.id} d={c.d} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />
      ))}
      {lplArrow && <path d={lplArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {synthArrow && <path d={synthArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {cholToVldlArrow && <path d={cholToVldlArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {liverTrigArrow && <path d={liverTrigArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {apoB100Arrow && <path d={apoB100Arrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {faSupplyArrow && <path d={faSupplyArrow} fill="none" stroke="currentColor" strokeWidth={1.25} strokeDasharray="3 3" markerEnd="url(#mc-lipid-head)" />}
      {liverToTrigArrow && <path d={liverToTrigArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {liverToApobArrow && <path d={liverToApobArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {retentionArrows.map((r) => (
        <path key={r.id} d={r.d} fill="none" stroke="currentColor" strokeWidth={1.25} strokeDasharray="3 3" markerEnd="url(#mc-lipid-head)" />
      ))}
      {enterocyteTrigArrow && <path d={enterocyteTrigArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {enterocyteApoB48Arrow && <path d={enterocyteApoB48Arrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {trigToChylomicronArrow && <path d={trigToChylomicronArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {apoB48ToChylomicronArrow && <path d={apoB48ToChylomicronArrow} fill="none" stroke="currentColor" strokeWidth={1.25} markerEnd="url(#mc-lipid-head)" />}
      {particleBonds.map((b) => (
        <path key={b.id} d={b.d} fill="none" stroke="var(--navy)" strokeWidth={1.5} />
      ))}
      {particleOutlines.map((o) => (
        // Capped to a third of the shorter side so LDL's near-square box stays a rounded rectangle, not a circle.
        <rect key={o.id} x={o.x} y={o.y} width={o.w} height={o.h} rx={Math.min(10, o.w / 3, o.h / 3)} fill="none" stroke="var(--lipid-outline)" strokeWidth={1.5} strokeDasharray="4 3" />
      ))}
      <AssociationLayer associations={associations} active={active} focused={focused} veil={veil} />
    </svg>
  );
}

// ---- cargo diagram ----

/** A bare icon with no bubble to fill reads bigger than a docked one. */
const STANDALONE_CHOL_ICON_SIZE = Math.round(SIZE.molecular * 1.35 * 1.3);

// ---- lipoprotein chain ----

/** Kept brief rather than sourced: not yet in lipoprotein-particles.json's cited sources. */
const LDL_UPTAKE_NOTE = 'LDL delivers cholesterol to peripheral cells via the LDL receptor';

/** Generic tissue cells, shared with Hormonal Pathways' Sertoli/Leydig. */
const CELLS_ART: GlyphArt = { src: '/pathways/leydig-cells.png', width: 50, height: 50, box: [7, 6, 48, 46], size: SIZE.cell };

/** `data-node="target-cells"` is what the arrow measurement queries. */
function TargetCellsNode() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node="target-cells" title={LDL_UPTAKE_NOTE}>
      <Glyph art={CELLS_ART} />
      <span className="mc-pathway-node-label" style={{ marginTop: 8 }}>Peripheral cells</span>
    </div>
  );
}

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

/** LPL's fatty-acid release is a real pathway distinct from LDL's cholesterol delivery, so it gets its own arrow. */
const LPL_NOTE = 'Lipoprotein lipase';
const LPL_ARROW_NOTE = "Lipoprotein lipase releases fatty acids from VLDL's triglycerides for muscle energy and fat storage";
const FATTY_ACID_ICON_SIZE = 34;
/** `size` is overridden per call site, since Glyph bakes the render size into the art object. */
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

/** VLDL -> IDL -> LDL is one ApoB-100 particle transforming, its circle counts falling as it sheds mass. */
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

/** ~4.8:1 content, so sized as a horizontal band rather than SIZE.organ's square. */
const ARTERY_WALL_ART: GlyphArt = { src: '/pathways/artery-wall.png?v=1', width: 1648, height: 355, box: [6, 6, 1642, 349], size: 760 };

const ARTERY_GAP = 'artery-gap';

/** `Glyph` renders a square box, which would leave a ~4.8:1 strip a sliver; this sizes the height from the aspect. */
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
  const [debugOn, setDebugOn] = useState(false);
  const debug = import.meta.env.DEV && debugOn;
  const { drags, activeId, reset: resetDrags } = useNodeDrag(layoutRef, debug);
  const toggleDebug = useCallback(() => {
    setDebugOn((prev) => {
      if (prev) resetDrags();
      return !prev;
    });
  }, [resetDrags]);
  const page = useAxisPage({
    panelName: PANEL_NAME,
    panelTests,
    allResults,
    rootRef: layoutRef,
    keepSelector: '.mc-pathway-pop, [data-caption], [data-badge]',
    isCardId: (id) => id === HMGCR || id === RETENTION,
  });
  const { dates, date, open, cardAt, hovered, badgeOpen, toggleChip } = page;
  const snapshot = useMemo(() => snapshotOf(allResults, resultsByDate, date, unitSystem), [allResults, resultsByDate, date, unitSystem]);

  return (
    <div>
      <PageHeader
        overline="Lipidology"
        titlePrimary="Lipid"
        titleAccent="Transport"
        description={['How fat and cholesterol travel through the blood, particle by particle']}
      />
      <AxisToolbar dates={dates} date={date} onPickDate={page.pickDate} unitSystem={unitSystem} onUnitSystemChange={onUnitSystemChange}>
        {import.meta.env.DEV && (
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
        )}
      </AxisToolbar>
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
                      {/* Nudges (position: relative + left/top) taken from the debug drag overlay's readout. */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', left: 72, top: 1 }} data-node="enterocyte-trig" title={TRIG_SYNTH_NOTE}>
                        <Glyph art={{ ...TRIGLYCERIDE_ART, size: SIZE.molecular }} alt="Triglyceride" />
                        <span className="mc-pathway-node-label" style={{ marginTop: 4 }}>TRIG</span>
                      </div>
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
        <BadgeColumn
          badges={BADGES}
          scopePrefix="lipid"
          open={badgeOpen}
          setOpen={page.setOpen}
          setHovered={page.setHovered}
          renderFace={(b) => {
            const { measure, calculated } = badgeFace(b, snapshot);
            return {
              status: measure.status,
              value: (
                <>
                  {valueText(measure)}
                  {calculated && <CalcTag />}
                </>
              ),
            };
          }}
          renderBody={(b, scope) => <BadgeBody badge={b} scope={scope} snapshot={snapshot} unitSystem={unitSystem} />}
        />
        {open === HMGCR && cardAt && <EnzymeCard left={cardAt.left} top={cardAt.top} />}
        {open === RETENTION && cardAt && <RetentionCard left={cardAt.left} top={cardAt.top} />}
      </div>
      {import.meta.env.DEV && debug && <DebugPanel drags={drags} activeId={activeId} />}
    </div>
  );
}

/** Dev-only: each dragged node's offset and positioning fields, so a drag translates into an exact CSS fix. */
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
