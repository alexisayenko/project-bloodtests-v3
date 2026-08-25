import { useMemo, useState, useEffect } from 'react';
import { useData } from '../../data/DataContext';
import { useResultsContext } from '../../data/ResultsContext';
import { fmtNum, formatResultReference, isOutOfRange } from '../../utils/format';
import { INDEX_DEFS, MARKER_LOINC, SI_US_UNIT, computeIndex, toUnit, zone, type IndexDef } from '../../data/computedIndices';
import type { Panel, Result } from '../../types';

type LoincRef = { label: string; loinc: string; longCommonName: string; unit: string };
type Observation = { short: string; full: string; longCommonName: string; loinc: string; unit?: string; also?: LoincRef[] };

type PanelDef = { name: string; panelId?: string; panelIds?: string[]; loincs?: string[]; excludeLoincs?: string[]; extraLoincs?: string[] };

const PANEL_DEFS: PanelDef[] = [
  { name: 'Hypogonadism', panelId: 'hpg-axis', extraLoincs: ['1751-7', '2276-4', '11580-8', '5763-8', '1989-3', '4548-4'] },
  { name: 'Hypothyroidism', panelId: 'thyroid', extraLoincs: ['1989-3'] },
  { name: 'Adrenal', panelId: 'hpa-axis', extraLoincs: ['2191-5'] },
  { name: 'Insulin Resistance', panelId: 'glucose-metabolism', excludeLoincs: ['1798-8', '3040-3'], extraLoincs: ['2571-8', '2085-9'] },
  { name: 'Cardiovascular Risk', panelIds: ['cardiovascular-inflammatory', 'lipid-metabolism'] },
  { name: 'Fatty Liver', panelId: 'liver-function', extraLoincs: ['777-3', '2571-8', '4548-4', '2339-0'] },
  { name: 'Kidney Function', panelId: 'kidney-function', extraLoincs: ['2951-2', '2823-3', '2075-0', '17861-6', '2777-1', '1751-7', '2339-0', '9318-7'] },
  { name: 'Anemia', panelId: 'iron-metabolism', extraLoincs: ['787-2', '785-6', '786-4', '788-0', '2132-9', '2284-8'] },
  { name: 'Bone and Mineral Metabolism', panelId: 'vitamins-minerals-electrolytes', extraLoincs: ['2697-1', '41171-0', '77370-5', '9622-2', '17838-4', '6768-6', '1751-7'] },
  { name: 'Pancreatic Function', loincs: ['1798-8', '3040-3'], extraLoincs: ['25907-7', '2339-0', '4548-4', '20448-7', '2571-8', '17861-6', '6768-6', '2324-2', '1975-2', '1968-7', '1986-9'] },
  { name: 'FBC', panelId: 'fbc' },
];

// No `short`/`unit` field exists in the real catalog data — keep the short badge
// labels and reference units as a local lookup, keyed by loinc.
const SHORT_LABELS: Record<string, { short: string; unit: string }> = {
  // Hypogonadism
  '14913-8': { short: 'T', unit: 'nmol/L' },
  '2991-8': { short: 'FT', unit: 'pg/mL' },
  '10501-5': { short: 'LH', unit: 'mIU/mL' },
  '15067-2': { short: 'FSH', unit: 'mIU/mL' },
  '15081-3': { short: 'PRL', unit: 'ng/mL' },
  '2942-1': { short: 'SHBG', unit: 'nmol/L' },
  '2243-4': { short: 'E2', unit: 'pg/mL' },
  '1848-1': { short: 'DHT', unit: 'ng/dL' },
  '2191-5': { short: 'DHEA-S', unit: 'mcg/dL' },
  // Hypothyroidism
  '11580-8': { short: 'TSH', unit: 'mIU/L' },
  '3051-0': { short: 'FT3', unit: 'pg/mL' },
  '3024-7': { short: 'FT4', unit: 'ng/dL' },
  '8099-4': { short: 'TPO', unit: 'IU/mL' },
  '8098-6': { short: 'TG', unit: 'IU/mL' },
  '5385-0': { short: 'TRAb', unit: 'IU/L' },
  '1992-7': { short: 'CT', unit: 'pg/mL' },
  // Adrenal
  '2141-0': { short: 'ACTH', unit: 'pg/mL' },
  '2143-6': { short: 'CORT', unit: 'mcg/dL' },
  // Insulin Resistance
  '20448-7': { short: 'INS', unit: 'uIU/mL' },
  '2339-0': { short: 'GLU', unit: 'mg/dL' },
  '4548-4': { short: 'A1c', unit: '%' },
  '59261-8': { short: 'A1cI', unit: 'mmol/mol' },
  '13979-8': { short: 'GA', unit: '%' },
  '1557-8': { short: 'FRA', unit: 'umol/L' },
  '1986-9': { short: 'C-P', unit: 'ng/mL' },
  // Cardiovascular Risk
  '1988-5': { short: 'CRP', unit: 'mg/L' },
  '30522-7': { short: 'hsCRP', unit: 'mg/L' },
  '26881-3': { short: 'IL6', unit: 'pg/mL' },
  '3167-4': { short: 'TNFA', unit: 'pg/mL' },
  '49246-0': { short: 'oxLDL', unit: 'U/L' },
  '2293-7': { short: 'LEP', unit: 'ng/mL' },
  '56660-9': { short: 'ADIPO', unit: 'mcg/mL' },
  '13965-9': { short: 'HCY', unit: 'umol/L' },
  '3255-7': { short: 'FIB', unit: 'mg/dL' },
  '2093-3': { short: 'TC', unit: 'mg/dL' },
  '2085-9': { short: 'HDL', unit: 'mg/dL' },
  '13457-7': { short: 'LDL', unit: 'mg/dL' },
  '2571-8': { short: 'TRIG', unit: 'mg/dL' },
  '9830-1': { short: 'TC/HDL', unit: 'ratio' },
  '1884-6': { short: 'ApoB', unit: 'mg/dL' },
  '1869-7': { short: 'ApoA1', unit: 'mg/dL' },
  '10835-7': { short: 'Lp(a)', unit: 'mg/dL' },
  // Fatty Liver
  '6768-6': { short: 'ALP', unit: 'U/L' },
  '1968-7': { short: 'DBIL', unit: 'mg/dL' },
  '1971-1': { short: 'IBIL', unit: 'mg/dL' },
  '1975-2': { short: 'TBIL', unit: 'mg/dL' },
  '1920-8': { short: 'AST', unit: 'U/L' },
  '1742-6': { short: 'ALT', unit: 'U/L' },
  '2324-2': { short: 'GGT', unit: 'U/L' },
  '2710-2': { short: 'PCHE', unit: 'U/L' },
  '5195-3': { short: 'HBsAg', unit: 'Positive/Negative' },
  '16128-1': { short: 'HCV', unit: 'Positive/Negative' },
  '1751-7': { short: 'ALB', unit: 'g/dL' },
  '10834-0': { short: 'GLOB', unit: 'g/dL' },
  '2885-2': { short: 'TP', unit: 'g/dL' },
  // Kidney Function
  '3094-0': { short: 'BUN', unit: 'mg/dL' },
  '2160-0': { short: 'CREA', unit: 'mg/dL' },
  '3084-1': { short: 'UA', unit: 'mg/dL' },
  '48642-3': { short: 'eGFR', unit: 'mL/min/1.73m2' },
  '33863-2': { short: 'CYSC', unit: 'mg/L' },
  '9318-7': { short: 'ACR', unit: 'mg/g' }, // Albumin/Creatinine ratio, urine
  // Anemia
  '789-8': { short: 'RBC', unit: 'x10^6/uL' },
  '718-7': { short: 'HGB', unit: 'g/dL' },
  '4544-3': { short: 'HCT', unit: '%' },
  '2498-4': { short: 'FE', unit: 'mcg/dL' },
  '2276-4': { short: 'FERR', unit: 'ng/mL' },
  '2500-7': { short: 'TIBC', unit: 'mcg/dL' },
  '2501-5': { short: 'UIBC', unit: 'mcg/dL' },
  '3034-6': { short: 'TRF', unit: 'mg/dL' },
  '2502-3': { short: 'TSAT', unit: '%' },
  // Bone and Mineral Metabolism
  '2998-3': { short: 'B1', unit: 'nmol/L' },
  '30552-4': { short: 'B6', unit: 'nmol/L' },
  '2284-8': { short: 'B9', unit: 'ng/mL' },
  '2132-9': { short: 'B12', unit: 'pg/mL' },
  '1989-3': { short: '25OH', unit: 'ng/mL' },
  '17861-6': { short: 'Ca', unit: 'mg/dL' },
  '1994-3': { short: 'iCa', unit: 'mmol/L' },
  '2075-0': { short: 'Cl', unit: 'mmol/L' },
  '2777-1': { short: 'PHOS', unit: 'mg/dL' },
  '2823-3': { short: 'K+', unit: 'mmol/L' },
  '19123-9': { short: 'Mg', unit: 'mg/dL' },
  '29900-7': { short: 'MgRBC', unit: 'mg/dL' },
  '2951-2': { short: 'Na', unit: 'mmol/L' },
  '5763-8': { short: 'Zn', unit: 'mcg/dL' },
  '2731-8': { short: 'PTH', unit: 'pg/mL' },
  // Bone turnover markers
  '2697-1': { short: 'OC', unit: 'ng/mL' }, // Osteocalcin
  '41171-0': { short: 'CTX', unit: 'ng/mL' }, // Beta-CrossLaps/CTX
  '77370-5': { short: 'P1NP', unit: 'ng/mL' }, // Procollagen type I N-terminal propeptide
  '9622-2': { short: 'VitK', unit: 'ng/mL' }, // Vitamin K1
  '17838-4': { short: 'BALP', unit: 'ug/L' }, // Bone-specific alkaline phosphatase
  // Pancreatic Function
  '1798-8': { short: 'AMY', unit: 'U/L' },
  '3040-3': { short: 'LIP', unit: 'U/L' },
  '25907-7': { short: 'ELA1', unit: 'ug/g' }, // Pancreatic elastase-1, stool
  // FBC — Leukocytes and Differentials
  '6690-2': { short: 'WBC', unit: 'x10^3/uL' },
  '751-8': { short: 'NEUT#', unit: 'x10^3/uL' },
  '731-0': { short: 'LYMPH#', unit: 'x10^3/uL' },
  '742-7': { short: 'MONO#', unit: 'x10^3/uL' },
  '711-2': { short: 'EOS#', unit: 'x10^3/uL' },
  '704-7': { short: 'BASO#', unit: 'x10^3/uL' },
  '770-8': { short: 'NEUT%', unit: '%' },
  '736-9': { short: 'LYMPH%', unit: '%' },
  '5905-5': { short: 'MONO%', unit: '%' },
  '713-8': { short: 'EOS%', unit: '%' },
  '706-2': { short: 'BASO%', unit: '%' },
  // FBC — Erythrocytes (789-8, 718-7, 4544-3 already defined above under Anemia)
  '787-2': { short: 'MCV', unit: 'fL' },
  '785-6': { short: 'MCH', unit: 'pg' },
  '786-4': { short: 'MCHC', unit: 'g/dL' },
  '788-0': { short: 'RDW', unit: '%' },
  '21000-5': { short: 'RDW-SD', unit: 'fL?' },
  // FBC — Platelets
  '777-3': { short: 'PLT', unit: 'x10^3/uL' },
  '32623-1': { short: 'MPV', unit: 'fL' },
  '32207-3': { short: 'PDW', unit: 'fL?' },
  '58410-2': { short: 'P-LCR', unit: '%?' },
  '74464-9': { short: 'P-LCC', unit: 'x10^3/uL?' },
  '61928-1': { short: 'PCT', unit: '%?' },
};

// Manually curated cross-references (not sourced from panels.json).
const ALSO_REFS: Record<string, LoincRef[]> = {
  '14913-8': [{ label: 'ng/dL unit', loinc: '2986-8', longCommonName: 'Testosterone [Mass/volume] in Serum or Plasma', unit: 'ng/dL' }],
  '2942-1': [{ label: 'nmol/L unit', loinc: '13967-5', longCommonName: 'Sex hormone binding globulin [Moles/volume] in Serum or Plasma', unit: 'nmol/L' }],
  '1989-3': [{ label: 'D2+D3 combined', loinc: '62292-8', longCommonName: '25-Hydroxyvitamin D3+25-Hydroxyvitamin D2 [Mass/volume] in Serum or Plasma', unit: 'ng/mL' }],
  '4548-4': [{ label: 'by calculation', loinc: '17855-8', longCommonName: 'Hemoglobin A1c/Hemoglobin.total in Blood by calculation', unit: '%' }],
  '2777-1': [{ label: 'whole blood', loinc: '2774-8', longCommonName: 'Phosphate [Mass/volume] in Blood', unit: 'mg/dL' }],
  '15081-3': [{ label: 'Mass/volume variant', loinc: '2842-3', longCommonName: 'Prolactin [Mass/volume] in Serum or Plasma', unit: 'ng/mL' }],
  '3094-0': [{ label: 'Urea', loinc: '3091-6', longCommonName: 'Urea [Mass/volume] in Serum or Plasma', unit: 'mg/dL' }],
  '1848-1': [{ label: 'nmol/L unit', loinc: '15057-3', longCommonName: 'Androstanolone (Dihydrotestosterone) [Moles/volume] in Serum or Plasma', unit: 'nmol/L' }],
};

// Computed/derived values (ratios, estimates) rather than direct measurements. TC/HDL
// ratio and % Iron Saturation are also independently reportable by a lab (LOINCs
// 9830-1, 2502-3) but are shown via COMPUTED_LOINCS's own formula instead once one
// applies -- kept here only so they never show as raw badges in the grid. eGFR
// (48642-3) has no computed twin (needs age, which v3 doesn't have) and stays
// purely lab-reported.
const INDEX_LOINCS = new Set(['9830-1', '2502-3', '48642-3']);

// LOINCs that a computed index (see computedIndices.ts) can independently
// duplicate from a lab report -- excluded from the raw-LOINC Indices table so
// each one renders once, via its computed row, not twice.
const COMPUTED_LOINCS = new Set(INDEX_DEFS.map((d) => d.loinc).filter((x): x is string => !!x));

// Reverse of MARKER_LOINC, for looking up an observation's SI/US conversion by
// whichever LOINC it happens to be recorded under.
const LOINC_TO_MARKER: Record<string, string> = Object.fromEntries(
  Object.entries(MARKER_LOINC).flatMap(([marker, loincs]) => loincs.map((loinc) => [loinc, marker]))
);

function getPanelLoincs(panel: Panel): string[] {
  if (panel.sections) return panel.sections.flatMap((section) => section.loincs);
  return panel.loincs ?? [];
}

type PopupPosition = { left: number; top?: number; bottom?: number };
type PopupState =
  | ({ kind: 'observation'; test: Observation } & PopupPosition)
  | ({ kind: 'index'; def: IndexDef } & PopupPosition);

// Three top-level sections (the nav menu), each its own URL hash, so the
// browser's back/forward always works. Panel detail nests under Monitoring
// Panels. Popups are transient overlays, not routes -- they never touch history.
type Route =
  | { view: 'panels' }
  | { view: 'panel'; name: string }
  | { view: 'reference' }
  | { view: 'profile' };

const NAV_ITEMS: { view: 'reference' | 'panels' | 'profile'; label: string }[] = [
  { view: 'reference', label: 'Reference Book' },
  { view: 'panels', label: 'Monitoring Panels' },
  { view: 'profile', label: 'Profile' },
];

function routeToHash(route: Route): string {
  if (route.view === 'panel') return `#panels/${encodeURIComponent(route.name)}`;
  if (route.view === 'reference') return '#reference';
  if (route.view === 'profile') return '#profile';
  return '#panels';
}

function hashToRoute(hash: string): Route {
  const value = decodeURIComponent(hash.replace(/^#/, ''));
  if (!value || value === 'panels') return { view: 'panels' };
  if (value === 'reference') return { view: 'reference' };
  if (value === 'profile') return { view: 'profile' };
  if (value.startsWith('panels/')) return { view: 'panel', name: value.slice('panels/'.length) };
  return { view: 'panel', name: value }; // back-compat with pre-nav-menu links
}

const STATUS_STYLES = {
  'never': { border: '#ccc', background: '#f5f5f5', color: '#999' },
  'in-range': { border: '#34a853', background: '#e6f4ea', color: '#1a1a1a' },
  'out-of-range': { border: '#ea4335', background: '#fdecea', color: '#1a1a1a' },
  'unknown': { border: '#1971c2', background: 'transparent', color: '#1a1a1a' },
} as const;

// 3-zone coloring for computed indices (see data/computedIndices.ts's `zone()`).
const ZONE_BG = { ok: '#e6f4ea', warn: '#fff4e0', bad: '#fdecea' } as const;
// Selected-row variants, blended with the row-selection blue (#eaf3fb).
const SELECTED_ZONE_BG = { ok: '#dbecf0', warn: '#e7ecea', bad: '#e6e8f0' } as const;

const BADGE_WIDTH = 84;
const BADGE_GAP = 12;
const PANEL_PADDING = 20;
const PANEL_GAP = 24;
const PANEL_WIDTH = BADGE_WIDTH * 3 + BADGE_GAP * 2 + PANEL_PADDING * 2;

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = String(d.getFullYear()).slice(-2);
  return `${month} ${year}`;
}

// The optimal (green-zone) range implied by an index's cut-points, formatted
// like a lab reference range -- same orientation `zone()` uses to color a cell.
function greenRangeOf(def: IndexDef): string {
  const cmp = def.hi ? '>' : '<';
  const unit = def.unit ? ` ${def.unit}` : '';
  return `${cmp} ${fmtNum(def.cut[0])}${unit}`;
}

// The Analysis-tab controls (unit system, samplings shown, column order) are
// one shared setting across every panel already (component-level state, not
// per-panel) -- persisted here so they also survive a page refresh.
const ANALYSIS_SETTINGS_KEY = 'bloodtests_analysis_settings_v1';
type AnalysisSettings = { unitSystem: 'si' | 'us'; sampleLimit: number | 'all'; dateOrder: 'asc' | 'desc' };
const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = { unitSystem: 'si', sampleLimit: 'all', dateOrder: 'desc' };

function loadAnalysisSettings(): AnalysisSettings {
  try {
    const raw = localStorage.getItem(ANALYSIS_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_ANALYSIS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return DEFAULT_ANALYSIS_SETTINGS;
}

export function MedicalConditionsPage() {
  const { analysesCatalog, panels } = useData();
  const { sessions, loadGroupItems } = useResultsContext();
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [selectedLoinc, setSelectedLoinc] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));
  const [detailTab, setDetailTab] = useState<'analysis' | 'in-range'>('analysis');
  const [unitSystem, setUnitSystem] = useState<'si' | 'us'>(() => loadAnalysisSettings().unitSystem);
  const [sampleLimit, setSampleLimit] = useState<number | 'all'>(() => loadAnalysisSettings().sampleLimit);
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>(() => loadAnalysisSettings().dateOrder);
  const [allResults, setAllResults] = useState<{ loinc: string; date: string; result: Result }[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(ANALYSIS_SETTINGS_KEY, JSON.stringify({ unitSystem, sampleLimit, dateOrder }));
    } catch {
      // storage unavailable (private browsing, quota) -- setting just won't persist
    }
  }, [unitSystem, sampleLimit, dateOrder]);

  const POPUP_WIDTH = 260;
  const INDEX_POPUP_WIDTH = 380;

  const conditions = useMemo(() => {
    return PANEL_DEFS.map((def) => {
      let loincs: string[];
      if (def.panelIds) {
        loincs = def.panelIds.flatMap((id) => {
          const panel = panels.find((p) => p.id === id);
          return panel ? getPanelLoincs(panel) : [];
        });
      } else if (def.panelId) {
        const panel = panels.find((p) => p.id === def.panelId);
        loincs = panel ? getPanelLoincs(panel) : [];
      } else {
        loincs = def.loincs ?? [];
      }
      if (def.excludeLoincs) {
        loincs = loincs.filter((loinc) => !def.excludeLoincs!.includes(loinc));
      }
      loincs = [...loincs, ...(def.extraLoincs ?? [])];
      const tests: Observation[] = loincs.map((loinc) => {
        const analysis = analysesCatalog[loinc];
        const labelInfo = SHORT_LABELS[loinc];
        return {
          short: labelInfo?.short ?? analysis?.displayName ?? loinc,
          full: analysis?.displayName ?? loinc,
          longCommonName: analysis?.longCommonName ?? '',
          loinc,
          unit: labelInfo?.unit,
          also: ALSO_REFS[loinc],
        };
      });
      return { name: def.name, tests };
    });
  }, [panels, analysesCatalog]);

  useEffect(() => {
    // The single source of truth for the current route is always the URL, so
    // back/forward -- browser buttons or in-app links -- stay in sync by
    // construction, and any open popup (a transient overlay, not a page) is
    // always dropped on navigation instead of surviving over the new view.
    const onPopState = () => {
      setPopup(null);
      setRoute(hashToRoute(window.location.hash));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: Route) => {
    window.history.pushState(null, '', routeToHash(next));
    setPopup(null);
    setRoute(next);
  };

  const openDetail = (name: string) => {
    navigate({ view: 'panel', name });
    setDetailTab('analysis');
  };

  const openReference = () => navigate({ view: 'reference' });

  const navEl = (
    <div style={{ display: 'flex', gap: 32, marginBottom: 32, borderBottom: '1.5px solid #eee' }}>
      {NAV_ITEMS.map((item) => {
        const active = route.view === item.view || (item.view === 'panels' && route.view === 'panel');
        return (
          <div
            key={item.view}
            onClick={() => navigate({ view: item.view })}
            style={{
              padding: '12px 2px',
              marginBottom: -1.5,
              borderBottom: active ? '2px solid #1971c2' : '2px solid transparent',
              fontSize: 15,
              fontWeight: active ? 600 : 400,
              color: active ? '#1971c2' : '#555',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );

  useEffect(() => {
    let cancelled = false;

    async function buildAllResults() {
      const all: { loinc: string; date: string; result: Result }[] = [];
      for (const session of sessions) {
        const items = session.items ?? (await loadGroupItems(session.file));
        for (const item of items) {
          all.push({ loinc: item.loinc, date: session.date, result: item });
        }
      }
      if (!cancelled) setAllResults(all);
    }

    buildAllResults();
    return () => {
      cancelled = true;
    };
  }, [sessions, loadGroupItems]);

  const latestByLoinc = useMemo(() => {
    const map: Record<string, { result: Result; date: string }> = {};
    for (const { loinc, date, result } of allResults) {
      const existing = map[loinc];
      if (!existing || date > existing.date) map[loinc] = { result, date };
    }
    return map;
  }, [allResults]);

  // Per-date lookup for computed indices: { date: { loinc: Result } }.
  const resultsByDate = useMemo(() => {
    const map: Record<string, Record<string, Result>> = {};
    for (const { loinc, date, result } of allResults) {
      (map[date] ??= {})[loinc] = result;
    }
    return map;
  }, [allResults]);

  const latestIndexValue = (def: IndexDef): { value: number; date: string } | null => {
    const dates = Object.keys(resultsByDate).sort((a, b) => b.localeCompare(a));
    for (const date of dates) {
      const value = computeIndex(def, resultsByDate[date]!);
      if (value != null) return { value, date };
    }
    return null;
  };

  const popupPosition = (rect: DOMRect, width: number): PopupPosition => {
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(center - width / 2, 8), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Open upward when there's little room below and more room above --
    // keeps the popup from running off the bottom of the viewport for a
    // row near the end of a long page.
    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      return { left, bottom: window.innerHeight - rect.top + 8 };
    }
    return { left, top: rect.bottom + 8 };
  };

  const openPopup = (test: Observation, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ kind: 'observation', test, ...popupPosition(rect, POPUP_WIDTH) });
  };

  const openIndexPopup = (def: IndexDef, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ kind: 'index', def, ...popupPosition(rect, INDEX_POPUP_WIDTH) });
  };

  const getLatest = (loincs: string[]): { result: Result; date: string } | null => {
    let current: { result: Result; date: string } | null = null;
    for (const loinc of loincs) {
      const candidate = latestByLoinc[loinc];
      if (candidate && (!current || candidate.date > current.date)) current = candidate;
    }
    return current;
  };

  type Status = 'never' | 'in-range' | 'out-of-range' | 'unknown';
  const getStatus = (loincs: string[]): Status => {
    const current = getLatest(loincs);
    if (!current) return 'never';
    const hasRef = current.result.value != null && (current.result.refMin != null || current.result.refMax != null);
    if (!hasRef) return 'unknown';
    return isOutOfRange(current.result) ? 'out-of-range' : 'in-range';
  };

  const testLoincs = (test: Observation) => [test.loinc, ...(test.also?.map((ref) => ref.loinc) ?? [])];

  const renderLatest = (loincs: string[]) => {
    const current = getLatest(loincs);
    if (!current) {
      return (
        <div style={{ fontSize: 13, color: '#888', marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
          Never taken
        </div>
      );
    }
    const value = current.result.rawValue || fmtNum(current.result.value);
    const hasRef = current.result.value != null && (current.result.refMin != null || current.result.refMax != null);
    const bg = hasRef ? (isOutOfRange(current.result) ? '#fdecea' : '#e6f4ea') : 'transparent';
    return (
      <div style={{ fontSize: 13, color: '#555', marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
        <div style={{ fontWeight: 500, color: '#333' }}>Latest taken on {formatMonthYear(current.date)}</div>
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: bg }}>
          {value} {current.result.unit}
          <span style={{ color: '#888' }}> (Ref: {formatResultReference(current.result)})</span>
        </div>
      </div>
    );
  };

  const popupEl = popup && (
    <>
      <div onClick={() => setPopup(null)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
      <div
        style={{
          position: 'fixed',
          top: popup.top,
          bottom: popup.bottom,
          left: popup.left,
          background: '#fff',
          border: '1.5px solid #1971c2',
          borderRadius: 12,
          padding: 18,
          width: popup.kind === 'index' ? INDEX_POPUP_WIDTH : POPUP_WIDTH,
          // Cap to whatever room is actually left on the anchored side, not just
          // the viewport height -- otherwise a popup opened partway down the
          // page can still try to render taller than the space below it.
          maxHeight: popup.top != null ? `calc(100vh - ${popup.top}px - 8px)` : `calc(100vh - ${popup.bottom}px - 8px)`,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          boxSizing: 'border-box',
          zIndex: 101,
        }}
      >
        {popup.kind === 'observation' ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {popup.test.full}
              {popup.test.full !== popup.test.short && ` (${popup.test.short})`}
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: popup.test.also ? 10 : 0 }}>
              <a
                href={`https://loinc.org/${popup.test.loinc}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: 'monospace', color: '#1971c2' }}
              >
                {popup.test.loinc}
              </a>{' '}
              {popup.test.longCommonName}
              {popup.test.unit ? `, ${popup.test.unit}` : ''}
            </div>
            {popup.test.also?.map((ref) => (
              <div key={ref.loinc} style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
                <a
                  href={`https://loinc.org/${ref.loinc}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily: 'monospace', color: '#1971c2' }}
                >
                  {ref.loinc}
                </a>{' '}
                {ref.longCommonName}, {ref.unit}
              </div>
            ))}
            {renderLatest([popup.test.loinc, ...(popup.test.also?.map((ref) => ref.loinc) ?? [])])}
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              {popup.def.name}
              {popup.def.name !== popup.def.nameCompact && ` (${popup.def.nameCompact})`}
            </div>
            <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-line', marginBottom: 10 }}>{popup.def.formula}</div>
            {(() => {
              const latest = latestIndexValue(popup.def);
              const reported = popup.def.loinc ? latestByLoinc[popup.def.loinc] : undefined;
              return (
                <>
                  <div style={{ fontSize: 13, color: '#555', paddingTop: 8, borderTop: '1px solid #eee' }}>
                    {latest ? (
                      <>
                        <div style={{ fontWeight: 500, color: '#333' }}>Calculated, {formatMonthYear(latest.date)}</div>
                        <div
                          style={{
                            marginTop: 4,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: ZONE_BG[zone(latest.value, popup.def.cut[0], popup.def.cut[1], popup.def.hi)],
                          }}
                        >
                          {fmtNum(latest.value)} {popup.def.unit ?? ''}
                          <span style={{ color: '#888' }}> (Ref: {greenRangeOf(popup.def)})</span>
                        </div>
                      </>
                    ) : (
                      'Not enough data to calculate yet'
                    )}
                  </div>
                  {reported && (
                    <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
                      <div style={{ fontWeight: 500, color: '#333' }}>Lab reported, {formatMonthYear(reported.date)}</div>
                      <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: '#f5f5f5' }}>
                        {reported.result.rawValue || fmtNum(reported.result.value)} {reported.result.unit}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            <div style={{ fontSize: 13, color: '#333', marginTop: 10 }}>{popup.def.meaning}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{popup.def.evidenceLevel}</span>
              {popup.def.references[0] && ` -- ${popup.def.references[0].organization}`}
            </div>
            <div
              onClick={openReference}
              style={{ fontSize: 13, color: '#1971c2', fontWeight: 500, marginTop: 10, cursor: 'pointer' }}
            >
              Learn more →
            </div>
          </>
        )}
      </div>
    </>
  );

  if (route.view === 'profile') {
    return (
      <div style={{ padding: '56px 48px' }}>
        {navEl}
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>Profile</h1>
        <div style={{ color: '#888', fontSize: 14 }}>Coming soon.</div>
        {popupEl}
      </div>
    );
  }

  if (route.view === 'reference') {
    return (
      <div style={{ padding: '56px 48px' }}>
        {navEl}
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>Reference</h1>
        <div style={{ color: '#888', fontSize: 14 }}>
          Coming soon -- full physiology, evidence and citations for every computed index.
        </div>
        {popupEl}
      </div>
    );
  }

  if (route.view === 'panel') {
    const detailPanel = route.name;
    const condition = conditions.find((c) => c.name === detailPanel);
    const tests = condition?.tests ?? [];
    const observations = tests.filter((t) => !INDEX_LOINCS.has(t.loinc));
    const indices = tests.filter((t) => INDEX_LOINCS.has(t.loinc) && !COMPUTED_LOINCS.has(t.loinc));
    const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(detailPanel));
    const computedInputLoincs = new Set(
      computedForPanel.flatMap((d) => d.needs.flatMap((short) => MARKER_LOINC[short] ?? []))
    );

    const dates = Array.from(
      new Set(
        allResults
          .filter((r) => tests.some((t) => testLoincs(t).includes(r.loinc)) || computedInputLoincs.has(r.loinc))
          .map((r) => r.date)
      )
    ).sort((a, b) => b.localeCompare(a));

    const recentDates = sampleLimit === 'all' ? dates : dates.slice(0, sampleLimit);
    const visibleDates = dateOrder === 'asc' ? [...recentDates].reverse() : recentDates;

    const cellMatch = (test: Observation, date: string) => {
      const loincs = testLoincs(test);
      return allResults.find((r) => r.date === date && loincs.includes(r.loinc)) ?? null;
    };

    const DATE_COL_WIDTH = 96;
    // Shared across observations and both indices tables so they line up as one block.
    const LABEL_COL_WIDTH = 140;

    const renderTable = (rowTests: Observation[], label: string) => (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: LABEL_COL_WIDTH, textAlign: 'left', padding: '8px 12px', borderBottom: '1.5px solid #1971c2', whiteSpace: 'nowrap' }}>
                {label}
              </th>
              {visibleDates.map((date) => (
                <th
                  key={date}
                  style={{
                    width: DATE_COL_WIDTH,
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderBottom: '1.5px solid #1971c2',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatMonthYear(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowTests.map((test) => {
              const selected = selectedLoinc === test.loinc;
              const marker = LOINC_TO_MARKER[test.loinc];
              const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
              const displayUnit = siUsUnit ? siUsUnit[unitSystem] : test.unit;
              return (
              <tr key={test.loinc} style={{ background: selected ? '#eaf3fb' : undefined }}>
                <td
                  onClick={(e) => {
                    setSelectedLoinc(test.loinc);
                    openPopup(test, e);
                  }}
                  style={{ width: LABEL_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 600 }}>{test.short}</span>
                  {displayUnit && `, ${displayUnit}`}
                </td>
                {visibleDates.map((date) => {
                  const match = cellMatch(test, date);
                  if (!match) {
                    return (
                      <td
                        key={date}
                        onClick={() => setSelectedLoinc(test.loinc)}
                        style={{ width: DATE_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                      >
                        –
                      </td>
                    );
                  }
                  const hasRef = match.result.value != null && (match.result.refMin != null || match.result.refMax != null);
                  const bg = hasRef
                    ? (isOutOfRange(match.result) ? (selected ? '#e6e8f0' : '#fdecea') : (selected ? '#dbecf0' : '#e6f4ea'))
                    : (selected ? '#eaf3fb' : 'transparent');
                  // Coloring always uses the as-reported value/range (self-consistent);
                  // only the displayed number is converted for the toggle.
                  const displayValue =
                    siUsUnit && match.result.value != null
                      ? toUnit(match.result.value, marker!, match.result.unit, siUsUnit[unitSystem])
                      : match.result.value;
                  return (
                    <td
                      key={date}
                      onClick={() => setSelectedLoinc(test.loinc)}
                      style={{
                        width: DATE_COL_WIDTH,
                        padding: '8px 12px',
                        borderBottom: '1px solid #eee',
                        whiteSpace: 'nowrap',
                        background: bg,
                        cursor: 'pointer',
                      }}
                    >
                      {fmtNum(displayValue)}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    const renderIndexTable = (defs: IndexDef[]) => (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: LABEL_COL_WIDTH, textAlign: 'left', padding: '8px 12px', borderBottom: '1.5px solid #1971c2', whiteSpace: 'nowrap' }}>
                Indices
              </th>
              {visibleDates.map((date) => (
                <th
                  key={date}
                  style={{
                    width: DATE_COL_WIDTH,
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderBottom: '1.5px solid #1971c2',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatMonthYear(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {defs.map((def) => {
              const selected = selectedLoinc === def.key;
              return (
                <tr key={def.key} style={{ background: selected ? '#eaf3fb' : undefined }}>
                  <td
                    onClick={(e) => {
                      setSelectedLoinc(def.key);
                      openIndexPopup(def, e);
                    }}
                    style={{ width: LABEL_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    <span style={{ fontWeight: 600 }}>{def.nameCompact}</span>
                    {def.unit && `, ${def.unit}`}
                  </td>
                  {visibleDates.map((date) => {
                    const value = computeIndex(def, resultsByDate[date] ?? {});
                    if (value == null) {
                      return (
                        <td
                          key={date}
                          onClick={() => setSelectedLoinc(def.key)}
                          style={{ width: DATE_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >
                          –
                        </td>
                      );
                    }
                    const z = zone(value, def.cut[0], def.cut[1], def.hi);
                    const bg = selected ? SELECTED_ZONE_BG[z] : ZONE_BG[z];
                    return (
                      <td
                        key={date}
                        onClick={() => setSelectedLoinc(def.key)}
                        style={{
                          width: DATE_COL_WIDTH,
                          padding: '8px 12px',
                          borderBottom: '1px solid #eee',
                          whiteSpace: 'nowrap',
                          background: bg,
                          cursor: 'pointer',
                        }}
                      >
                        {fmtNum(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    return (
      <div style={{ padding: '56px 48px' }}>
        {navEl}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', marginBottom: 20 }}>
          <span onClick={() => navigate({ view: 'panels' })} style={{ color: '#1971c2', cursor: 'pointer' }}>
            Monitoring Panels
          </span>
          <span>›</span>
          <span onClick={() => setDetailTab('analysis')} style={{ color: '#1971c2', cursor: 'pointer' }}>
            {detailPanel}
          </span>
          <span>›</span>
          <span>{detailTab === 'analysis' ? 'Analysis' : "What's in range"}</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>{detailPanel}</h1>
        <div style={{ display: 'flex', gap: 8, borderBottom: '1.5px solid #eee', marginBottom: 24 }}>
          {(['analysis', 'in-range'] as const).map((tab) => (
            <div
              key={tab}
              onClick={() => setDetailTab(tab)}
              style={{
                padding: '10px 4px',
                marginBottom: -2,
                borderBottom: detailTab === tab ? '2px solid #1971c2' : '2px solid transparent',
                fontWeight: detailTab === tab ? 600 : 400,
                color: detailTab === tab ? '#1971c2' : '#555',
                cursor: 'pointer',
              }}
            >
              {tab === 'analysis' ? 'Analysis' : "What's in range"}
            </div>
          ))}
        </div>

        {detailTab === 'analysis' ? (
          <div>
            <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Unit system</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['si', 'us'] as const).map((sys) => (
                    <div
                      key={sys}
                      onClick={() => setUnitSystem(sys)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 9999,
                        border: '1.5px solid #1971c2',
                        background: unitSystem === sys ? '#1971c2' : 'transparent',
                        color: unitSystem === sys ? '#fff' : '#1971c2',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {sys.toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Last N samplings</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([5, 10, 15, 'all'] as const).map((n) => (
                    <div
                      key={n}
                      onClick={() => setSampleLimit(n)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 9999,
                        border: '1.5px solid #1971c2',
                        background: sampleLimit === n ? '#1971c2' : 'transparent',
                        color: sampleLimit === n ? '#fff' : '#1971c2',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {n === 'all' ? 'All' : n}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Column order</div>
                <div
                  onClick={() => setDateOrder(dateOrder === 'desc' ? 'asc' : 'desc')}
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: 9999,
                    border: '1.5px solid #1971c2',
                    color: '#1971c2',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {dateOrder === 'desc' ? 'Newest → Oldest' : 'Oldest → Newest'}
                </div>
              </div>
            </div>
            {dates.length === 0 ? (
              <div style={{ color: '#888', fontSize: 14 }}>No results recorded for this panel yet.</div>
            ) : (
              <>
                {renderTable(observations, 'Observations')}
                {(indices.length > 0 || computedForPanel.length > 0) && (
                  <div style={{ marginTop: 16 }}>
                    {indices.length > 0 && renderTable(indices, 'Indices')}
                    {computedForPanel.length > 0 && renderIndexTable(computedForPanel)}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ color: '#888', fontSize: 14 }}>Coming soon.</div>
        )}
        {popupEl}
      </div>
    );
  }

  return (
    <div style={{ padding: '56px 48px' }}>
      {navEl}
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>Monitoring Panels</h1>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${PANEL_WIDTH}px)`, gap: PANEL_GAP }}>
        {conditions.map((condition) => (
          <div
            key={condition.name}
            style={{
              width: PANEL_WIDTH,
              border: '1.5px solid #1971c2',
              borderRadius: 16,
              padding: PANEL_PADDING,
              boxSizing: 'border-box',
            }}
          >
            <div
              onClick={() => openDetail(condition.name)}
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                marginBottom: 16,
                cursor: 'pointer',
              }}
            >
              {condition.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${BADGE_WIDTH}px)`, gap: BADGE_GAP }}>
              {condition.tests.filter((test) => !INDEX_LOINCS.has(test.loinc)).map((test) => {
                const style = STATUS_STYLES[getStatus(testLoincs(test))];
                return (
                <div
                  key={test.loinc}
                  onClick={(e) => openPopup(test, e)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: BADGE_WIDTH,
                    height: 40,
                    border: `1.5px solid ${style.border}`,
                    background: style.background,
                    color: style.color,
                    borderRadius: 9999,
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  {test.short}
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {popupEl}
    </div>
  );
}
