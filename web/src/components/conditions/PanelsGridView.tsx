import { useMemo, useState } from 'react';
import { BarChart2, Calculator, Link2, Search } from 'lucide-react';
import { computeIndex, zone, type IndexDef, type Zone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import type { Result } from '../../types';
import { INDEX_LOINCS, testLoincs, observationMatchesQuery, indexMatchesQuery, type Observation } from './markers';
import { pressable } from './ui';
import { getStatus, type LatestByLoinc } from './resultsLookup';
import { COLOR } from '../../styles/tokens';
import { getPanelMeta } from './panelMeta';

export type Condition = { name: string; tests: Observation[] };

/** Newest-first scan for the first draw with a computable value. */
function latestZone(def: IndexDef, datesDesc: string[], resultsByDate: Record<string, Record<string, Result>>): Zone | null {
  for (const date of datesDesc) {
    const value = computeIndex(def, resultsByDate[date]!);
    if (value != null) return zone(value, def.cut[0], def.cut[1], def.hi);
  }
  return null;
}

/**
 * A white rounded pill chip with an individual status dot indicator.
 * Shrinks to fit its label width naturally.
 */
function DotChip({
  label,
  dotColor,
  onClick,
}: Readonly<{ label: string; dotColor: string; onClick: (e: { currentTarget: HTMLElement }) => void }>) {
  return (
    <button
      type="button"
      {...pressable(onClick)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 15px',
        borderRadius: 9999,
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        fontSize: 13,
        fontWeight: 500,
        color: COLOR.text,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
        width: 'auto',
        fontFamily: 'inherit',
        lineHeight: 1.3,
        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}

export function PanelsGridView({
  conditions,
  latestByLoinc,
  resultsByDate,
  onOpenDetail,
  onOpenPopup,
  onOpenIndexPopup,
}: Readonly<{
  conditions: Condition[];
  latestByLoinc: LatestByLoinc;
  resultsByDate: Record<string, Record<string, Result>>;
  onOpenDetail: (name: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  onOpenIndexPopup: (def: IndexDef, e: { currentTarget: HTMLElement }) => void;
}>) {
  const [search, setSearch] = useState('');
  const datesDesc = useMemo(() => Object.keys(resultsByDate).sort((a, b) => b.localeCompare(a)), [resultsByDate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conditions;
    return conditions.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.tests.some((t) => observationMatchesQuery(t, q))) return true;
      const indices = INDEX_DEFS.filter((d) => d.panels.includes(c.name));
      return indices.some((d) => indexMatchesQuery(d, q));
    });
  }, [conditions, search]);

  return (
    <>
      {/* Page Header Banner */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 32,
          marginBottom: 32,
          padding: '8px 4px 28px',
          borderBottom: `1px solid ${COLOR.borderSubtle}`,
          flexWrap: 'wrap',
          background: 'radial-gradient(ellipse 60% 90% at 88% 20%, rgba(20, 117, 126, 0.06) 0%, rgba(20, 117, 126, 0) 70%)',
        }}
      >
        <div style={{ flex: '1 1 460px', minWidth: 300 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLOR.accent,
              marginBottom: 8,
            }}
          >
            Condition-Oriented Tracking
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.6, marginBottom: 12, lineHeight: 1.15 }}>
            <span style={{ color: COLOR.text }}>Monitoring </span>
            <span style={{ color: COLOR.accent }}>Panels</span>
          </h1>
          <div style={{ fontSize: 14, color: COLOR.textSecondary, lineHeight: 1.55 }}>
            <div>Follow condition-oriented monitoring panels instead of browsing report by report.</div>
            <div>Paneloom unifies markers across laboratories and helps you track what matters over time.</div>
          </div>
        </div>

        {/* Right side 3 feature pillars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BarChart2 size={20} color={COLOR.accent} strokeWidth={2.2} aria-hidden="true" />
            <div style={{ fontSize: 12, color: COLOR.textSecondary, lineHeight: 1.35 }}>
              <div>One timeline</div>
              <div>across labs</div>
            </div>
          </div>

          <div style={{ width: 1, height: 44, background: COLOR.borderSubtle }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link2 size={20} color={COLOR.accent} strokeWidth={2.2} aria-hidden="true" />
            <div style={{ fontSize: 12, color: COLOR.textSecondary, lineHeight: 1.35 }}>
              <div>Values normalized</div>
              <div>with LOINC codes</div>
            </div>
          </div>

          <div style={{ width: 1, height: 44, background: COLOR.borderSubtle }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Calculator size={20} color={COLOR.accent} strokeWidth={2.2} aria-hidden="true" />
            <div style={{ fontSize: 12, color: COLOR.textSecondary, lineHeight: 1.35 }}>
              <div>Focus on trends,</div>
              <div>not PDFs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: COLOR.surface,
            border: `1px solid ${COLOR.borderSubtle}`,
            borderRadius: 9999,
            padding: '6px 14px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Search size={14} color={COLOR.textMuted} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search markers or panels…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              color: COLOR.text,
              width: 170,
            }}
          />
        </label>
      </div>

      {/* Panels Grid */}
      <div className="mc-panels-grid">
        {filtered.map((condition) => {
          const meta = getPanelMeta(condition.name);
          const Icon = meta.icon;
          const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(condition.name));
          const observations = condition.tests.filter((t) => !INDEX_LOINCS.has(t.loinc));

          return (
            <div
              key={condition.name}
              className="mc-panel-card"
              style={{
                padding: '24px 22px',
                background: meta.bgColor,
                borderRadius: 16,
                border: `1px solid ${meta.borderColor}`,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Header: Circle Icon + Panel Name + Subtitle + Count */}
              <div
                {...pressable(() => onOpenDetail(condition.name))}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: meta.iconBg,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={26} color={meta.color} strokeWidth={2.2} aria-hidden="true" />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: COLOR.text, lineHeight: 1.3 }}>
                      {condition.name}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: COLOR.textMuted, flexShrink: 0 }}>
                      {observations.length} markers
                    </div>
                  </div>
                  {meta.description && (
                    <div style={{ fontSize: 13, color: COLOR.textSecondary, marginTop: 3, lineHeight: 1.35 }}>
                      {meta.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 1: Observations */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.text, marginBottom: 10 }}>
                  Observations
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {observations.map((test) => {
                    const status = getStatus(latestByLoinc, testLoincs(test));
                    const dotColor =
                      status === 'in-range'
                        ? '#16a34a'
                        : status === 'out-of-range'
                        ? '#dc2626'
                        : status === 'unknown'
                        ? '#f59e0b'
                        : '#94a3b8';

                    return (
                      <DotChip
                        key={test.loinc}
                        label={test.full}
                        dotColor={dotColor}
                        onClick={(e) => onOpenPopup(test, e)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Indices */}
              {computedForPanel.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.06)', paddingTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.text, marginBottom: 10 }}>
                    Indices
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {computedForPanel.map((def) => {
                      const z = latestZone(def, datesDesc, resultsByDate);
                      const dotColor =
                        z === 'ok' ? '#16a34a' : z === 'warn' ? '#f59e0b' : z === 'bad' ? '#dc2626' : '#94a3b8';

                      return (
                        <DotChip
                          key={def.key}
                          label={def.nameCompact}
                          dotColor={dotColor}
                          onClick={(e) => onOpenIndexPopup(def, e)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer: View panel → */}
              <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                <span
                  {...pressable(() => onOpenDetail(condition.name))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLOR.accent,
                    cursor: 'pointer',
                  }}
                >
                  View panel →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
