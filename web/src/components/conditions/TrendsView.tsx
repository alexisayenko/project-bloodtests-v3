import { useState, useMemo, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import type { ResultEntry } from './resultsLookup';
import { Card } from '../primitives/Card';
import { COLOR, RADIUS } from '../../styles/tokens';
import { pressable } from '../primitives/styles';
import { LabExplore } from '../../vendor/lab-explore/lab-explore';
import type { LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { buildExploreModel, type Condition } from './exploreModel';
import { testLoincs } from './markers';
import type { Result, UnitSystem } from '../../types';
import type { MedicationRow } from '../../data/storage/medications';
import { loadEnvelopeMeta } from '../../data/envelopeMeta';
import { SegmentedControl } from '../primitives';
import { buildMedicationBars, groupMedicationBarsByBrand, type MedicationBar } from './medicationBars';
import { PALETTE } from '../analytics/palette';
import { LOINC_TO_MARKER } from '../../data/computedIndices';
import { displayedResult, cellBg } from './resultCells';
import { molarPerMassUnit } from '../../data/molarMasses';
import { fmtNum, isOutOfRange } from '../../utils/format';
import { specimenOf } from '../../data/analyteCatalog';
import { hasReference } from './resultsLookup';
import { StatusValue } from './ResultTables';
import { formatMonthYear } from '../../data/months';

function paletteColor(index: number): string {
  const [r, g, b] = PALETTE[index % PALETTE.length]!;
  return `rgb(${r}, ${g}, ${b})`;
}

function formatCommonName(longCommonName: string | undefined, fallback: string): string {
  if (!longCommonName) return fallback;
  const specimen = specimenOf(longCommonName);
  if (specimen) {
    const beforeBracket = longCommonName.split('[')[0]?.trim();
    if (beforeBracket) {
      return `${beforeBracket} in ${specimen}`;
    }
  }
  return longCommonName.replace(/\s*\[[^[\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim() || fallback;
}

/** `ts` is epoch seconds UTC (the `MedicationBar` convention); back to the "YYYY-MM" key `formatMonthYear` reads. */
function tsToMonthKey(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Static badge row under the chart: one pill per medication brand, replacing the old chart-overlay lane. */
function MedicationBadgeRow({ bars }: Readonly<{ bars: MedicationBar[] }>) {
  const groups = groupMedicationBarsByBrand(bars);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
      {groups.map(({ brand, bars: groupBars }) => {
        const startTs = Math.min(...groupBars.map((b) => b.startTs));
        const endTs = Math.max(...groupBars.map((b) => b.endTs));
        // endTs is the exclusive start of the month after the last active one; back up a second to land in it.
        const span = `${formatMonthYear(tsToMonthKey(startTs))} – ${formatMonthYear(tsToMonthKey(endTs - 1))}`;
        const details = Array.from(new Set(groupBars.map((b) => b.detail).filter(Boolean)));
        const title = details.length > 0 ? `${details.join('; ')} · ${span}` : span;
        return (
          <span
            key={brand}
            title={title}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: RADIUS.pill,
              border: `1px solid ${COLOR.borderSubtle}`,
              background: COLOR.surfaceCard,
              fontSize: 12,
              fontWeight: 500,
              color: COLOR.navy,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: groupBars[0]!.color, flexShrink: 0 }} />
            {brand}
            <span style={{ fontSize: 11, fontWeight: 400, color: COLOR.textMuted }}>{span}</span>
          </span>
        );
      })}
    </div>
  );
}

if (typeof customElements !== 'undefined' && !customElements.get('lab-explore')) {
  customElements.define('lab-explore', LabExplore);
}

type LabExploreElement = HTMLElement & { model: LabExploreModel | null };

interface Props {
  conditions: Condition[];
  currentPanel?: string;
  allResults?: ResultEntry[];
  unitSystem?: UnitSystem;
  resultsByDate?: Record<string, Record<string, Result>>;
  medications?: MedicationRow[];
}

export function TrendsView({
  conditions,
  currentPanel,
  allResults = [],
  unitSystem = 'si',
  resultsByDate,
  medications,
}: Readonly<Props>) {
  const tests = useMemo(() => conditions.flatMap((c) => c.tests), [conditions]);

  // Available observations in this panel that have results
  const availableTests = useMemo(() => {
    return tests.filter((t) => allResults.some((r) => testLoincs(t).includes(r.loinc)));
  }, [tests, allResults]);

  // Active observation: default to first or Testosterone / first available
  const [selectedLoinc, setSelectedLoinc] = useState<string>(() => {
    const testO = availableTests.find(
      (t) => t.friendlyName.toLowerCase().includes('testosterone') || t.shortName.toLowerCase().includes('t')
    );
    return testO?.loinc ?? availableTests[0]?.loinc ?? tests[0]?.loinc ?? '';
  });

  const currentObservation = useMemo(() => {
    return tests.find((t) => t.loinc === selectedLoinc) ?? tests[0];
  }, [tests, selectedLoinc]);

  // Guideline reference range popup toggle
  const [showGuidelineInfo, setShowGuidelineInfo] = useState(false);
  // Normalized (% of ref range) vs Absolute vs Log values toggle
  const [chartMode, setChartMode] = useState<'normalized' | 'absolute' | 'log'>('normalized');

  // Reference to custom element
  const ref = useRef<HTMLElement | null>(null);
  const sex = loadEnvelopeMeta().sex;

  // Build model for standard lab-explore control
  const normalized = chartMode === 'normalized';
  const logScale = chartMode === 'log';
  const model = useMemo(() => {
    const built = buildExploreModel(
      conditions,
      allResults,
      unitSystem,
      currentPanel,
      resultsByDate,
      { sex }
    );
    const panelId = currentPanel ?? 'all';
    const viewId = `trends:${panelId}:${selectedLoinc || 'all'}`;
    return {
      ...built,
      title: '',
      intro: '',
      normalized,
      logScale,
      defaultSelection: selectedLoinc && built.markers[selectedLoinc] ? [selectedLoinc] : built.defaultSelection,
      persist: {
        sel: `exploreSel:${viewId}`,
        view: `hpgChartView:trends:${panelId}`,
        autoscale: `hpgAutoscale:trends:${panelId}`,
        evPrefix: `exploreEv:trends:${panelId}:`,
      },
    };
  }, [conditions, allResults, unitSystem, currentPanel, resultsByDate, sex, selectedLoinc, normalized, logScale]);

  const medicationBars = useMemo(
    () => (medications?.length ? buildMedicationBars(medications, paletteColor) : []),
    [medications]
  );

  useEffect(() => {
    let cancelled = false;
    customElements.whenDefined('lab-explore').then(() => {
      if (cancelled) return;
      const el = ref.current as LabExploreElement | null;
      if (el) el.model = model;
    });
    return () => {
      cancelled = true;
    };
  }, [model]);

  // Primary marker cards (scrollable row of markers in this panel)
  const primaryCards = useMemo(() => {
    const list = availableTests.length > 0 ? availableTests : tests;
    return list.map((test) => {
      const loincs = testLoincs(test);
      const results = allResults
        .filter((r) => loincs.includes(r.loinc) && (r.result.value != null || r.result.rawValue))
        .sort((a, b) => b.date.localeCompare(a.date));
      const latest = results[0];
      const prev = results[1];

      const markerKey = LOINC_TO_MARKER[test.loinc];
      const disp = latest?.result ? displayedResult(markerKey, latest.result, unitSystem) : null;

      let deltaPct: number | null = null;
      if (latest?.result.value != null && prev?.result.value != null && prev.result.value !== 0) {
        deltaPct = Math.round(((latest.result.value - prev.result.value) / prev.result.value) * 100);
      }

      const sparkPoints = results
        .filter((r) => r.result.value != null)
        .slice(0, 6)
        .reverse()
        .map((r) => {
          const d = displayedResult(markerKey, r.result, unitSystem);
          return d.value ?? r.result.value!;
        });

      return {
        test,
        latestValue: disp?.value != null ? fmtNum(disp.value) : (latest?.result.rawValue || '—'),
        unit: disp?.unit || latest?.result.unit || test.unit || '',
        deltaPct,
        sparkPoints,
      };
    });
  }, [availableTests, tests, allResults, unitSystem]);

  // Filter and sort results for this observation across all dates
  const observationResults = useMemo(() => {
    if (!currentObservation) return [];
    const loincs = testLoincs(currentObservation);
    return allResults
      .filter((r) => loincs.includes(r.loinc) && (r.result.value != null || r.result.rawValue))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allResults, currentObservation]);

  // Marker unit from explore model or current observation
  const displayUnit = model.markers[selectedLoinc]?.unit ?? currentObservation?.unit ?? '';

  // Fixed/known guideline ranges (e.g. Endocrine Society for Total Testosterone: 9.2 - 31.8 nmol/L)
  const guidelineRange = useMemo(() => {
    const isTestosterone =
      currentObservation?.friendlyName.toLowerCase().includes('testosterone') ||
      currentObservation?.loinc === '2986-8';
    if (!isTestosterone) return null;
    const isUs = unitSystem === 'us';
    const factor = isUs ? molarPerMassUnit('testosterone', 'ng/dL', 'nmol/L') : 1;
    const conv = isUs ? (factor > 0 ? 1 / factor : 28.84) : 1;
    const min = Math.round(9.2 * conv * (isUs ? 1 : 10)) / (isUs ? 1 : 10);
    const max = Math.round(31.8 * conv * (isUs ? 1 : 10)) / (isUs ? 1 : 10);
    return {
      min,
      max,
      source: 'Endocrine Society / CDC Harmonized',
    };
  }, [currentObservation, unitSystem]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Key Marker Summary Cards (Narrower & Scrollable Row with Edge Shading) */}
      <div style={{ position: 'relative', margin: '0 -4px' }}>
        {/* Scrollable track */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            padding: '4px 6px 12px 6px',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {primaryCards.map(({ test, latestValue, unit, deltaPct, sparkPoints }) => {
            const isSelected = test.loinc === currentObservation?.loinc;
            return (
              <Card
                key={test.loinc}
                padding="10px 14px"
                {...pressable(() => setSelectedLoinc(test.loinc))}
                style={{
                  flex: '0 0 160px',
                  width: 160,
                  cursor: 'pointer',
                  border: isSelected ? `2px solid ${COLOR.primary}` : `1px solid ${COLOR.borderSubtle}`,
                  background: isSelected ? '#f5fafd' : COLOR.surfaceCard,
                  borderRadius: RADIUS.card,
                  boxShadow: isSelected ? '0 2px 8px rgba(14, 90, 102, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isSelected ? COLOR.primary : COLOR.navy,
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={test.friendlyName}
                >
                  {test.friendlyName}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: COLOR.navy, letterSpacing: -0.5 }}>
                    {latestValue != null ? latestValue : '—'}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: COLOR.textMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {unit}
                  </span>

                  {deltaPct != null && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        fontWeight: 600,
                        color: deltaPct > 0 ? COLOR.statusWarnText : COLOR.statusOkText,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {deltaPct > 0 ? `↑ ${deltaPct}%` : `↓ ${Math.abs(deltaPct)}%`}
                    </span>
                  )}
                </div>

                {/* Sparkline */}
                {sparkPoints.length > 1 ? (
                  <div style={{ height: 16, marginTop: 4 }}>
                    <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke={isSelected ? COLOR.primary : '#38a3a5'}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={sparkPoints
                          .map((val, idx) => {
                            const x = (idx / (sparkPoints.length - 1)) * 96 + 2;
                            const min = Math.min(...sparkPoints);
                            const max = Math.max(...sparkPoints);
                            const range = max - min || 1;
                            const y = 14 - ((val - min) / range) * 11;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />
                    </svg>
                  </div>
                ) : (
                  <div style={{ height: 16, marginTop: 4 }} />
                )}
              </Card>
            );
          })}
        </div>

        {/* Right Scroll Gradient Shading */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 8,
            width: 40,
            background: 'linear-gradient(to right, rgba(246, 249, 250, 0), rgba(246, 249, 250, 0.95))',
            pointerEvents: 'none',
          }}
        />

        {/* Left Scroll Gradient Shading */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 8,
            width: 24,
            background: 'linear-gradient(to left, rgba(246, 249, 250, 0), rgba(246, 249, 250, 0.95))',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* 2. Standard Chart Control (<lab-explore>) */}
      <Card padding="20px 24px" style={{ borderRadius: RADIUS.card }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: COLOR.navy, margin: 0 }}>
              {currentObservation?.friendlyName ?? 'Marker'}
            </h2>
            <div style={{ fontSize: 13, color: COLOR.textMuted, marginTop: 2 }}>
              {currentObservation?.loinc && (
                <>
                  <a
                    href={`https://loinc.org/${currentObservation.loinc}/`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: COLOR.link,
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                    title={`Open LOINC ${currentObservation.loinc} on loinc.org`}
                  >
                    {currentObservation.loinc}
                  </a>
                  <span> · </span>
                </>
              )}
              <span>
                {formatCommonName(currentObservation?.longCommonName, currentObservation?.friendlyName ?? '')}
              </span>
            </div>

            {guidelineRange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13, color: COLOR.navy }}>
                <span>
                  Guideline Ref. Range: {guidelineRange.min}–{guidelineRange.max} {displayUnit}
                </span>
                <span
                  {...pressable(() => setShowGuidelineInfo(!showGuidelineInfo))}
                  style={{ cursor: 'pointer', display: 'inline-flex', color: COLOR.textMuted }}
                  title="Reference guideline details"
                >
                  <Info size={15} />
                </span>
              </div>
            )}
          </div>

          {/* Values Normalized / Absolute Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SegmentedControl
              label="Values"
              options={['normalized', 'absolute', 'log'] as const}
              value={chartMode}
              onChange={setChartMode}
              format={(v) => (v === 'normalized' ? 'Normalized values' : v === 'absolute' ? 'Absolute numbers' : 'Logarithmic scale')}
            />
          </div>
        </div>

        {/* Guideline Info Modal / Popover */}
        {showGuidelineInfo && (
          <div
            style={{
              padding: '10px 14px',
              background: '#f0f7ff',
              border: '1px solid #cfe2fe',
              borderRadius: RADIUS.control,
              fontSize: 12,
              color: COLOR.navy,
              marginBottom: 16,
              lineHeight: 1.4,
            }}
          >
            <strong>Guideline Reference Range:</strong> Established standard reference interval based on harmonized clinical cohorts (Endocrine Society). Individual laboratory reported ranges below may vary due to differing assay methodologies.
          </div>
        )}

        <lab-explore ref={ref} />
        {medicationBars.length > 0 && <MedicationBadgeRow bars={medicationBars} />}
      </Card>

      {/* 3. Result History Table */}
      <Card padding="0" style={{ borderRadius: RADIUS.card, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
            borderBottom: `1px solid ${COLOR.borderSubtle}`,
            background: COLOR.surfaceCard,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLOR.navy }}>
              {currentObservation?.friendlyName ?? 'Observation'}
            </h3>
            {currentObservation?.longCommonName && (
              <span style={{ fontSize: 13, color: COLOR.textMuted }}>
                {formatCommonName(currentObservation.longCommonName, currentObservation.friendlyName)}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: COLOR.textMuted, whiteSpace: 'nowrap' }}>
            {observationResults.length} result{observationResults.length === 1 ? '' : 's'}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${COLOR.borderSubtle}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Date ↑</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Observation</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Result</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Reference Range</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Laboratory</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Method</th>
            </tr>
          </thead>
          <tbody>
            {observationResults.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: COLOR.textMuted }}>
                  No results recorded for this marker.
                </td>
              </tr>
            ) : (
              observationResults.map((r, i) => {
                const markerKey = LOINC_TO_MARKER[currentObservation?.loinc ?? ''];
                const disp = displayedResult(markerKey, r.result, unitSystem);
                const scale = r.result.value && disp.value ? disp.value / r.result.value : 1;
                const min = r.result.refMin != null ? r.result.refMin * scale : null;
                const max = r.result.refMax != null ? r.result.refMax * scale : null;
                const hasNumericRange = min != null || max != null;

                const rangeStr =
                  min != null && max != null
                    ? `${fmtNum(min)} – ${fmtNum(max)}`
                    : min != null
                    ? `> ${fmtNum(min)}`
                    : max != null
                    ? `< ${fmtNum(max)}`
                    : r.result.refText ?? '—';

                const valStr = disp.value != null ? fmtNum(disp.value) : (r.result.rawValue || '—');
                const valUnit = disp.value != null && displayUnit && (
                  <span style={{ color: COLOR.textMuted, fontWeight: 400 }}> {displayUnit}</span>
                );
                const rangeUnit = hasNumericRange && displayUnit && (
                  <span style={{ color: COLOR.textMuted, fontWeight: 400 }}> {displayUnit}</span>
                );
                const hasRef = hasReference(r.result);
                const outOfRange = isOutOfRange(r.result);

                return (
                  <tr
                    key={r.date + i}
                    style={{
                      borderBottom: i < observationResults.length - 1 ? `1px solid ${COLOR.borderSubtle}` : 'none',
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: COLOR.navy, fontWeight: 500 }}>{r.date}</td>
                    <td style={{ padding: '12px 16px', color: COLOR.text }}>
                      <a
                        href={`https://loinc.org/${r.loinc}/`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: COLOR.link, textDecoration: 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                        title={`Open LOINC ${r.loinc} on loinc.org`}
                      >
                        {r.loinc}
                      </a>
                      <span> · </span>
                      {r.result.rawName}
                    </td>
                    <td style={{ padding: '12px 16px', color: COLOR.navy, fontWeight: 600 }}>
                      {hasRef ? (
                        <StatusValue tone={outOfRange ? 'bad' : 'ok'} bg={cellBg(hasRef, outOfRange, false)}>
                          {valStr}
                          {valUnit}
                        </StatusValue>
                      ) : (
                        <>
                          {valStr}
                          {valUnit}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: COLOR.text }}>
                      {rangeStr}
                      {rangeUnit}
                    </td>
                    <td style={{ padding: '12px 16px', color: COLOR.text }}>{r.place || '—'}</td>
                    <td style={{ padding: '12px 16px', color: COLOR.text }}>{r.result.method || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
