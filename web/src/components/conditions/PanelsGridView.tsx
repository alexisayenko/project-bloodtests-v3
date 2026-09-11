import { useMemo, useState } from 'react';
import { BarChart2, Calculator, Link2, Search } from 'lucide-react';
import { computeIndex, zone, type IndexDef, type Zone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import type { Result } from '../../types';
import { INDEX_LOINCS, testLoincs, observationMatchesQuery, indexMatchesQuery, type Observation } from './markers';
import { pressable } from './ui';
import { getStatus, type LatestByLoinc, type Status } from './resultsLookup';
import { COLOR } from '../../styles/tokens';
import { getPanelMeta } from './panelMeta';
import { PageHeader } from './PageHeader';

export type Condition = { name: string; tests: Observation[] };

const NEUTRAL_DOT = '#94a3b8';

const STATUS_DOT: Record<Status, string> = {
  'in-range': '#16a34a',
  'out-of-range': '#dc2626',
  unknown: '#f59e0b',
  never: NEUTRAL_DOT,
};

const ZONE_DOT: Record<Zone, string> = {
  ok: '#16a34a',
  warn: '#f59e0b',
  bad: '#dc2626',
};

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
      <PageHeader
        overline="Condition-Oriented Tracking"
        titlePrimary="Monitoring"
        titleAccent="Panels"
        description={[
          'Follow condition-oriented monitoring panels instead of browsing report by report.',
          'Paneloom unifies markers across laboratories and helps you track what matters over time.',
        ]}
        pillars={[
          { icon: BarChart2, line1: 'One timeline', line2: 'across labs' },
          { icon: Link2, line1: 'Values normalized', line2: 'with LOINC codes' },
          { icon: Calculator, line1: 'Focus on trends,', line2: 'not PDFs' },
        ]}
      />

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
                    const dotColor = STATUS_DOT[status];

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
                      const dotColor = z ? ZONE_DOT[z] : NEUTRAL_DOT;

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
