import { lazy, Suspense } from 'react';
import type { IndexDef } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import { COLOR } from '../../styles/tokens';
import { BookOpen, Calculator, ShieldCheck } from 'lucide-react';
import { EmptyState } from '../primitives';
import { EvidenceBadge } from '../reference/parts';
import { IndexDetail } from '../reference/IndexDetail';
import type { Observation } from './markers';
import { PageHeader } from './PageHeader';
import type { ResultEntry } from './resultsLookup';
import type { Route } from './routing';
import { pressable } from '../primitives/styles';

const HpAxisPage = lazy(() => import('../reference/HpAxisPage').then((m) => ({ default: m.HpAxisPage })));
const TestosteronePage = lazy(() => import('../reference/TestosteronePage').then((m) => ({ default: m.TestosteronePage })));
const MolarMassesPage = lazy(() => import('../reference/MolarMassesPage').then((m) => ({ default: m.MolarMassesPage })));
const UnitsPage = lazy(() => import('../reference/UnitsPage').then((m) => ({ default: m.UnitsPage })));
const LoincDatabasePage = lazy(() => import('../reference/LoincDatabasePage').then((m) => ({ default: m.LoincDatabasePage })));
const FshPage = lazy(() => import('../reference/FshPage').then((m) => ({ default: m.FshPage })));

const pageFallback = <EmptyState style={{ minHeight: 400 }}>Loading…</EmptyState>;

function SubPage({
  indexKey,
  navigate,
  allResults,
  onOpenPopup,
}: Readonly<{
  indexKey: string;
  navigate: (r: Route) => void;
  allResults?: readonly ResultEntry[];
  onOpenPopup?: (test: Observation, e: { currentTarget: HTMLElement }) => void;
}>) {
  if (indexKey === 'hp-axis') return <HpAxisPage />;
  if (indexKey === 'testosterone') return <TestosteronePage onOpenPopup={onOpenPopup} />;
  if (indexKey === 'molar-masses') return <MolarMassesPage />;
  if (indexKey === 'units') return <UnitsPage navigate={navigate} />;
  if (indexKey === 'loinc-database') return <LoincDatabasePage allResults={allResults} navigate={navigate} />;
  if (indexKey === 'fsh') return <FshPage />;
  return null;
}

const SUB_PAGE_KEYS = new Set(['hp-axis', 'testosterone', 'molar-masses', 'units', 'loinc-database', 'fsh']);

export function ReferenceBookPage({
  indexKey,
  navigate,
  allResults,
  onOpenPopup,
}: Readonly<{
  indexKey?: string;
  navigate: (r: Route) => void;
  allResults?: readonly ResultEntry[];
  onOpenPopup?: (test: Observation, e: { currentTarget: HTMLElement }) => void;
}>) {
  if (indexKey && SUB_PAGE_KEYS.has(indexKey)) {
    return (
      <Suspense fallback={pageFallback}>
        <SubPage indexKey={indexKey} navigate={navigate} allResults={allResults} onOpenPopup={onOpenPopup} />
      </Suspense>
    );
  }
  const def = indexKey ? INDEX_DEFS.find((d) => d.key === indexKey) : undefined;
  if (def) return <IndexDetail def={def} />;

  // Index list, grouped by the first monitoring panel each index belongs to.
  const groups = new Map<string, IndexDef[]>();
  for (const d of INDEX_DEFS) {
    const panel = d.panels[0] ?? 'Other';
    (groups.get(panel) ?? groups.set(panel, []).get(panel)!).push(d);
  }

  return (
    <div>
      <PageHeader
        overline="Clinical Knowledge Base"
        titlePrimary="Reference"
        titleAccent="Book"
        description={[
          'Evidence-graded clinical guidance, reference ranges, and index calculation formulas.',
          'Understand your results through published consensus standards and clinical trials.',
        ]}
        pillars={[
          { icon: BookOpen, line1: 'Curated clinical', line2: 'guidelines' },
          { icon: Calculator, line1: 'Evidence-based', line2: 'index formulas' },
          { icon: ShieldCheck, line1: 'Graded reference', line2: 'ranges' },
        ]}
      />
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Organism-wide aspects</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'hp-axis' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>HP Axis</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>Hypothalamic–pituitary feedback loops (HPT · HPG · HPA)</span>
      </div>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'testosterone' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>Testosterone</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>
          Secretion, plasma binding, conversion to DHT/E2, feedback and clomiphene
        </span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Formulas and math</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'molar-masses' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>Mass ↔ molar conversion</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>Molar masses, their sources, and the factors derived from them</span>
      </div>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'units' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>Units and how they are read</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>
          UCUM, the three normalization stages, and what is never converted
        </span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Analytes</h2>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'loinc-database' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>LOINC database</span>
        <span style={{ fontSize: 14, color: COLOR.textSecondary }}>
          Every analyte the app knows — code, name, specimen, units and panels
        </span>
      </div>
      <div
        {...pressable(() => navigate({ view: 'reference', key: 'fsh' }))}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer', marginBottom: 24 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>FSH</span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Indices and derived measurements</h2>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 24 }}>
        Physiology, evidence standing and cited sources for every value the app calculates — derived measurements, a real
        analyte's concentration arrived at arithmetically, and indices proper, ratios and scores this app computes itself
        rather than taking from the lab (even one a lab may also print, like TC/HDL-C).
      </div>
      {Array.from(groups.entries()).map(([panel, defs]) => (
        <div key={panel} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', color: COLOR.textMuted, marginBottom: 10 }}>
            {panel}
          </div>
          {defs.map((d) => (
            <div
              key={d.key}
              {...pressable(() => navigate({ view: 'reference', key: d.key }))}
              style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.accent }}>{d.shortName}</span>
              <span style={{ fontSize: 14, color: COLOR.textSecondary }}>{d.friendlyName}</span>
              <EvidenceBadge level={d.evidenceLevel} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
