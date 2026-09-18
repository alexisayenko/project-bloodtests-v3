import { useState, useMemo } from 'react';
import { Info, ChevronDown } from 'lucide-react';
import type { Observation } from './markers';
import type { ResultEntry } from './resultsLookup';
import { Card } from '../primitives/Card';
import { COLOR, RADIUS } from '../../styles/tokens';
import { pressable } from '../primitives/styles';
import { ANALYTE_BY_LOINC } from '../../data/analyteCatalog';
import { molarPerMassUnit } from '../../data/molarMasses';

interface Props {
  name?: string;
  tests?: Observation[];
  allResults?: ResultEntry[];
}

export function TrendsView({ tests = [], allResults = [] }: Readonly<Props>) {
  // Available observations in this panel that have results
  const availableTests = useMemo(() => {
    return tests.filter((t) => allResults.some((r) => r.loinc === t.loinc));
  }, [tests, allResults]);

  // Active observation: default to first or Testosterone / first available
  const [selectedLoinc, setSelectedLoinc] = useState<string>(() => {
    const testO = availableTests.find((t) => t.friendlyName.toLowerCase().includes('testosterone') || t.shortName.toLowerCase().includes('t'));
    return testO?.loinc ?? availableTests[0]?.loinc ?? tests[0]?.loinc ?? '';
  });

  const currentObservation = useMemo(() => {
    return tests.find((t) => t.loinc === selectedLoinc) ?? tests[0];
  }, [tests, selectedLoinc]);

  // Unit switcher state
  const catalogAnalyte = currentObservation ? ANALYTE_BY_LOINC[currentObservation.loinc] : undefined;
  const canonicalUnit = currentObservation?.unit ?? catalogAnalyte?.unit ?? 'nmol/L';
  const alternativeUnit = canonicalUnit === 'nmol/L' ? 'ng/dL' : canonicalUnit === 'mg/dL' ? 'mmol/L' : undefined;

  const [activeUnit, setActiveUnit] = useState<string>(canonicalUnit);

  // Conversion factor between mass and molar if applicable
  const conversionFactor = useMemo(() => {
    if (!alternativeUnit || activeUnit === canonicalUnit) return 1;
    try {
      if (canonicalUnit === 'nmol/L' && activeUnit === 'ng/dL') {
        // ng/dL to nmol/L factor is ~0.03467, so nmol/L to ng/dL is 1 / 0.03467 (~28.84)
        const factor = molarPerMassUnit('testosterone', 'ng/dL', 'nmol/L');
        return factor > 0 ? 1 / factor : 1;
      }
      if (canonicalUnit === 'ng/dL' && activeUnit === 'nmol/L') {
        return molarPerMassUnit('testosterone', 'ng/dL', 'nmol/L');
      }
    } catch {
      return 1;
    }
    return 1;
  }, [canonicalUnit, activeUnit, alternativeUnit]);

  // Filter and sort results for this observation across all dates
  const observationResults = useMemo(() => {
    if (!currentObservation) return [];
    return allResults
      .filter((r) => r.loinc === currentObservation.loinc && r.result.value != null)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allResults, currentObservation]);

  // Primary marker cards (scrollable row of markers in this panel)
  const primaryCards = useMemo(() => {
    const list = availableTests.length > 0 ? availableTests : tests;
    return list.map((test) => {
      const results = allResults
        .filter((r) => r.loinc === test.loinc && r.result.value != null)
        .sort((a, b) => b.date.localeCompare(a.date));
      const latest = results[0];
      const prev = results[1];

      let deltaPct: number | null = null;
      if (latest && prev && prev.result.value && latest.result.value) {
        deltaPct = Math.round(((latest.result.value - prev.result.value) / prev.result.value) * 100);
      }

      const sparkPoints = results.slice(0, 6).reverse().map((r) => r.result.value!);

      return {
        test,
        latestValue: latest?.result.value,
        unit: latest?.result.unit ?? test.unit ?? '',
        deltaPct,
        sparkPoints,
      };
    });
  }, [availableTests, tests, allResults]);

  // Guideline reference range popup toggle
  const [showGuidelineInfo, setShowGuidelineInfo] = useState(false);

  // Chronological results for chart (earliest to latest)
  const chartPoints = useMemo(() => {
    return [...observationResults].reverse().map((r) => {
      const val = (r.result.value ?? 0) * conversionFactor;
      const refMin = r.result.refMin != null ? r.result.refMin * conversionFactor : undefined;
      const refMax = r.result.refMax != null ? r.result.refMax * conversionFactor : undefined;
      return {
        date: r.date,
        year: r.date.slice(0, 4),
        val,
        refMin,
        refMax,
        place: r.place,
      };
    });
  }, [observationResults, conversionFactor]);

  // Fixed/known guideline ranges (e.g. Endocrine Society for Total Testosterone: 9.2 - 31.8 nmol/L)
  const guidelineRange = useMemo(() => {
    const isTestosterone = currentObservation?.friendlyName.toLowerCase().includes('testosterone') || currentObservation?.loinc === '2986-8';
    if (!isTestosterone) return null;
    const baseMin = 9.2;
    const baseMax = 31.8;
    return {
      min: Math.round(baseMin * conversionFactor * 10) / 10,
      max: Math.round(baseMax * conversionFactor * 10) / 10,
      source: 'Endocrine Society / CDC Harmonized',
    };
  }, [currentObservation, conversionFactor]);

  // SVG Chart Layout Calculations
  const chartW = 760;
  const chartH = 220;
  const padL = 40;
  const padR = 24;
  const padT = 20;
  const padB = 36;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const yMax = useMemo(() => {
    let m = 35;
    for (const p of chartPoints) {
      if (p.val > m) m = p.val;
      if (p.refMax && p.refMax > m) m = p.refMax;
    }
    if (guidelineRange && guidelineRange.max > m) m = guidelineRange.max;
    return Math.ceil(m * 1.15);
  }, [chartPoints, guidelineRange]);

  const getY = (val: number) => padT + plotH - (val / yMax) * plotH;
  const getX = (idx: number, count: number) => {
    if (count <= 1) return padL + plotW / 2;
    return padL + (idx / (count - 1)) * plotW;
  };

  // Construct SVG polygon for the report-specific reference range band
  const refBandPath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    const upperPoints: string[] = [];
    const lowerPoints: string[] = [];

    chartPoints.forEach((p, idx) => {
      const x = getX(idx, chartPoints.length);
      const top = getY(p.refMax ?? (guidelineRange?.max ?? 30));
      const bottom = getY(p.refMin ?? (guidelineRange?.min ?? 9));
      upperPoints.push(`${x},${top}`);
      lowerPoints.unshift(`${x},${bottom}`);
    });

    return `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPoints, guidelineRange, yMax]);

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
                  <span style={{ fontSize: 11, color: COLOR.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      {/* 2. Interactive Analyte Timeline Chart */}
      <Card padding="20px 24px" style={{ borderRadius: RADIUS.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: COLOR.navy, margin: 0 }}>
              {currentObservation?.friendlyName ?? 'Marker'}
            </h2>
            <div style={{ fontSize: 13, color: COLOR.textMuted, marginTop: 2 }}>
              LOINC {currentObservation?.loinc} · {currentObservation?.longCommonName}
            </div>

            {guidelineRange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13, color: COLOR.navy }}>
                <span>
                  Guideline Ref. Range: {guidelineRange.min}–{guidelineRange.max} {activeUnit}
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

          {/* Unit Switcher */}
          {alternativeUnit && (
            <div style={{ position: 'relative' }}>
              <select
                aria-label="Select Unit"
                value={activeUnit}
                onChange={(e) => setActiveUnit(e.target.value)}
                style={{
                  padding: '6px 28px 6px 12px',
                  borderRadius: RADIUS.control,
                  border: `1px solid ${COLOR.border}`,
                  background: COLOR.surfaceCard,
                  color: COLOR.navy,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  appearance: 'none',
                }}
              >
                <option value={canonicalUnit}>{canonicalUnit}</option>
                <option value={alternativeUnit}>{alternativeUnit}</option>
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: COLOR.textMuted,
                }}
              />
            </div>
          )}
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

        {/* SVG Main Timeline Chart */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} style={{ minWidth: 500, overflow: 'visible' }}>
            {/* Horizontal Grid lines */}
            {[0, 10, 20, 30, 40].map((tick) => {
              if (tick > yMax) return null;
              const y = getY(tick);
              return (
                <g key={tick}>
                  <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#eaf0f4" strokeDasharray="3 3" />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill={COLOR.textMuted}>
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Shaded Laboratory Reference Range Band */}
            {refBandPath && (
              <path d={refBandPath} fill="rgba(76, 175, 122, 0.12)" />
            )}

            {/* Reference Band Upper & Lower dashed boundary lines */}
            {chartPoints.map((p, idx) => {
              if (idx === 0) return null;
              const prev = chartPoints[idx - 1]!;
              const x1 = getX(idx - 1, chartPoints.length);
              const x2 = getX(idx, chartPoints.length);
              const topY1 = getY(prev.refMax ?? (guidelineRange?.max ?? 30));
              const topY2 = getY(p.refMax ?? (guidelineRange?.max ?? 30));
              const botY1 = getY(prev.refMin ?? (guidelineRange?.min ?? 9));
              const botY2 = getY(p.refMin ?? (guidelineRange?.min ?? 9));
              return (
                <g key={`band-${p.date}`}>
                  <line x1={x1} y1={topY1} x2={x2} y2={topY2} stroke="#4caf7a" strokeWidth="1.5" strokeDasharray="4 3" opacity={0.8} />
                  <line x1={x1} y1={botY1} x2={x2} y2={botY2} stroke="#4caf7a" strokeWidth="1.5" strokeDasharray="4 3" opacity={0.8} />
                </g>
              );
            })}

            {/* Trend Data Line */}
            {chartPoints.map((p, idx) => {
              if (idx === 0) return null;
              const prev = chartPoints[idx - 1]!;
              const x1 = getX(idx - 1, chartPoints.length);
              const y1 = getY(prev.val);
              const x2 = getX(idx, chartPoints.length);
              const y2 = getY(p.val);
              return (
                <line key={`trend-${p.date}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0e8388" strokeWidth="2.5" />
              );
            })}

            {/* Data Dots & X-axis Dates */}
            {chartPoints.map((p, idx) => {
              const x = getX(idx, chartPoints.length);
              const y = getY(p.val);
              return (
                <g key={p.date}>
                  <circle cx={x} cy={y} r="4.5" fill="#0e8388" stroke="#ffffff" strokeWidth="2" />
                  <text x={x} y={chartH - 10} textAnchor="middle" fontSize="12" fill={COLOR.navy} fontWeight={500}>
                    {p.year}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLOR.navy }}>
            <span style={{ width: 14, height: 3, background: '#0e8388', borderRadius: 2 }} />
            <span>{currentObservation?.friendlyName} ({activeUnit})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLOR.navy }}>
            <span style={{ width: 18, height: 0, borderTop: '2px dashed #4caf7a' }} />
            <span>Laboratory reference range (varies by report)</span>
          </div>
        </div>
      </Card>

      {/* 3. Result History Table */}
      <Card padding="0" style={{ borderRadius: RADIUS.card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${COLOR.borderSubtle}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Date ↑</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Result ({activeUnit})</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Reference Range ({activeUnit})</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: COLOR.navy }}>Laboratory</th>
            </tr>
          </thead>
          <tbody>
            {observationResults.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: COLOR.textMuted }}>
                  No results recorded for this marker.
                </td>
              </tr>
            ) : (
              observationResults.map((r, i) => {
                const val = (r.result.value ?? 0) * conversionFactor;
                const min = r.result.refMin != null ? r.result.refMin * conversionFactor : null;
                const max = r.result.refMax != null ? r.result.refMax * conversionFactor : null;

                const rangeStr = min != null && max != null
                  ? `${min.toFixed(1)} – ${max.toFixed(1)}`
                  : r.result.refText ?? '—';

                return (
                  <tr
                    key={r.date + i}
                    style={{
                      borderBottom: i < observationResults.length - 1 ? `1px solid ${COLOR.borderSubtle}` : 'none',
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: COLOR.navy, fontWeight: 500 }}>{r.date}</td>
                    <td style={{ padding: '12px 16px', color: COLOR.navy, fontWeight: 600 }}>{val.toFixed(1)}</td>
                    <td style={{ padding: '12px 16px', color: COLOR.text }}>{rangeStr}</td>
                    <td style={{ padding: '12px 16px', color: COLOR.text }}>{r.place || '—'}</td>
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
