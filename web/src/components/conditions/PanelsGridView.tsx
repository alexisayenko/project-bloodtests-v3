import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { computeIndex, zone, type IndexDef, type Zone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import type { Result } from '../../types';
import { INDEX_LOINCS, testLoincs, type Observation } from './markers';
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
        padding: '6px 14px',
        borderRadius: 9999,
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.05)',
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
        e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.08)';
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
    return conditions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.tests.some((t) => t.short.toLowerCase().includes(q))
    );
  }, [conditions, search]);

  return (
    <>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLOR.accent,
              marginBottom: 6,
            }}
          >
            Condition-Oriented Tracking
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, color: COLOR.text, marginBottom: 8 }}>
            Monitoring Panels
          </h1>
          <p style={{ fontSize: 15, color: COLOR.textSecondary, maxWidth: 680, lineHeight: 1.45 }}>
            Follow key markers, indices and trends over time, grouped by health condition.
          </p>
        </div>

        {/* Search */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: COLOR.surface,
            border: `1px solid ${COLOR.borderSubtle}`,
            borderRadius: 9999,
            padding: '7px 16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            alignSelf: 'flex-start',
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
                padding: '22px 20px',
                background: meta.bgColor,
                borderRadius: 16,
                border: '1px solid rgba(0, 0, 0, 0.04)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {/* Header: Circle Icon + Panel Name + Subtitle */}
              <div
                {...pressable(() => onOpenDetail(condition.name))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
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
                  <Icon size={22} color={meta.color} strokeWidth={2} aria-hidden="true" />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.text, lineHeight: 1.3 }}>
                    {condition.name}
                  </div>
                  {meta.description && (
                    <div style={{ fontSize: 13, color: COLOR.textSecondary, marginTop: 3, lineHeight: 1.35 }}>
                      {meta.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Chips with status indicators, shrinking individually */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {observations.map((test) => {
                  const status = getStatus(latestByLoinc, testLoincs(test));
                  const dotColor =
                    status === 'in-range'
                      ? '#10b981'
                      : status === 'out-of-range'
                      ? '#ef4444'
                      : status === 'unknown'
                      ? '#f59e0b'
                      : '#9ca3af';

                  return (
                    <DotChip
                      key={test.loinc}
                      label={test.short}
                      dotColor={dotColor}
                      onClick={(e) => onOpenPopup(test, e)}
                    />
                  );
                })}
                {computedForPanel.map((def) => {
                  const z = latestZone(def, datesDesc, resultsByDate);
                  const dotColor =
                    z === 'ok' ? '#10b981' : z === 'warn' ? '#f59e0b' : z === 'bad' ? '#ef4444' : '#9ca3af';

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
          );
        })}
      </div>
    </>
  );
}
