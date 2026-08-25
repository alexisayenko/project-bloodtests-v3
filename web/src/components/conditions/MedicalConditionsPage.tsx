import { useMemo, useState, useEffect } from 'react';
import { useData } from '../../data/DataContext';
import { useResultsContext } from '../../data/ResultsContext';
import { fmtNum, formatResultReference, isOutOfRange } from '../../utils/format';
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
  '9830-1': { short: 'AI', unit: 'ratio' },
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

// Computed/derived values (ratios, estimates) rather than direct measurements.
const INDEX_LOINCS = new Set(['9830-1', '2502-3', '48642-3']); // Atherogenic Index, % Iron Saturation, eGFR

function getPanelLoincs(panel: Panel): string[] {
  if (panel.sections) return panel.sections.flatMap((section) => section.loincs);
  return panel.loincs ?? [];
}

type PopupState = { test: Observation; top: number; left: number };

const STATUS_STYLES = {
  'never': { border: '#ccc', background: '#f5f5f5', color: '#999' },
  'in-range': { border: '#34a853', background: '#e6f4ea', color: '#1a1a1a' },
  'out-of-range': { border: '#ea4335', background: '#fdecea', color: '#1a1a1a' },
  'unknown': { border: '#1971c2', background: 'transparent', color: '#1a1a1a' },
} as const;

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

export function MedicalConditionsPage() {
  const { analysesCatalog, panels } = useData();
  const { sessions, loadGroupItems } = useResultsContext();
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [selectedLoinc, setSelectedLoinc] = useState<string | null>(null);
  const [detailPanel, setDetailPanel] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'analysis' | 'in-range'>('analysis');
  const [unitSystem, setUnitSystem] = useState<'si' | 'us'>('si');
  const [sampleLimit, setSampleLimit] = useState<number | 'all'>('all');
  const [allResults, setAllResults] = useState<{ loinc: string; date: string; result: Result }[]>([]);

  const POPUP_WIDTH = 260;

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
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) setDetailPanel(hash);

    const onPopState = (e: PopStateEvent) => {
      setDetailPanel(e.state?.panel ?? null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openDetail = (name: string) => {
    window.history.pushState({ panel: name }, '', `#${encodeURIComponent(name)}`);
    setDetailPanel(name);
    setDetailTab('analysis');
  };

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

  const openPopup = (test: Observation, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(center - POPUP_WIDTH / 2, 8), window.innerWidth - POPUP_WIDTH - 8);
    setPopup({ test, top: rect.bottom + 8, left });
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
          left: popup.left,
          background: '#fff',
          border: '1.5px solid #1971c2',
          borderRadius: 12,
          padding: 18,
          width: 260,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          boxSizing: 'border-box',
          zIndex: 101,
        }}
      >
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
      </div>
    </>
  );

  if (detailPanel) {
    const condition = conditions.find((c) => c.name === detailPanel);
    const tests = condition?.tests ?? [];
    const observations = tests.filter((t) => !INDEX_LOINCS.has(t.loinc));
    const indices = tests.filter((t) => INDEX_LOINCS.has(t.loinc));

    const dates = Array.from(
      new Set(
        allResults
          .filter((r) => tests.some((t) => testLoincs(t).includes(r.loinc)))
          .map((r) => r.date)
      )
    ).sort((a, b) => b.localeCompare(a));

    const visibleDates = sampleLimit === 'all' ? dates : dates.slice(0, sampleLimit);

    const cellMatch = (test: Observation, date: string) => {
      const loincs = testLoincs(test);
      return allResults.find((r) => r.date === date && loincs.includes(r.loinc)) ?? null;
    };

    const DATE_COL_WIDTH = 96;

    const renderTable = (rowTests: Observation[]) => (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1.5px solid #1971c2' }} />
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
              return (
              <tr key={test.loinc} style={{ background: selected ? '#eaf3fb' : undefined }}>
                <td
                  onClick={(e) => {
                    setSelectedLoinc(test.loinc);
                    openPopup(test, e);
                  }}
                  style={{ padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 600 }}>{test.short}</span>
                  {test.unit && `, ${test.unit}`}
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
                      {match.result.rawValue || fmtNum(match.result.value)}
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
        <div
          onClick={() => window.history.back()}
          style={{ fontSize: 14, color: '#1971c2', cursor: 'pointer', marginBottom: 24 }}
        >
          ← Monitoring Panels
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
            <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: '#888', marginRight: 4 }}>Last</span>
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
              <span style={{ fontSize: 13, color: '#888' }}>samplings</span>
            </div>
            {dates.length === 0 ? (
              <div style={{ color: '#888', fontSize: 14 }}>No results recorded for this panel yet.</div>
            ) : (
              <>
                {renderTable(observations)}
                {indices.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', margin: '24px 0 12px' }}>
                      Indices
                    </div>
                    {renderTable(indices)}
                  </>
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
