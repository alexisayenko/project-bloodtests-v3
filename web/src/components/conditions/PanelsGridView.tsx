import { useMemo, useState } from 'react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { computeIndex, zone, type IndexDef, type Zone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import type { Result } from '../../types';
import { INDEX_LOINCS, testLoincs, type Observation } from './markers';
import { STATUS_STYLES, ZONE_DOT, pressable } from './ui';
import { getStatus, type LatestByLoinc } from './resultsLookup';
import { COLOR } from '../../styles/tokens';
import { getPanelMeta } from './panelMeta';

export type Condition = { name: string; tests: Observation[] };

/** Newest-first scan for computable index value. */
function latestZone(def: IndexDef, datesDesc: string[], resultsByDate: Record<string, Record<string, Result>>): Zone | null {
  for (const date of datesDesc) {
    const value = computeIndex(def, resultsByDate[date]!);
    if (value != null) return zone(value, def.cut[0], def.cut[1], def.hi);
  }
  return null;
}

/** Colored dot + label inline item. */
function DotItem({
  label,
  dotColor,
  onClick,
}: Readonly<{ label: string; dotColor: string; onClick: (e: { currentTarget: HTMLElement }) => void }>) {
  return (
    <div
      {...pressable(onClick)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLOR.text, cursor: 'pointer', padding: '2px 0' }}
    >
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

function LegendItem({ color, label }: Readonly<{ color: string; label: string }>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLOR.textSecondary }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </div>
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
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
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
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>Monitoring Panels</h1>
          <p style={{ fontSize: 14, color: COLOR.textSecondary }}>Organized views of key markers, indices and trends.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Search */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: '6px 12px' }}>
            <Search size={14} color={COLOR.textMuted} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search panels, markers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: COLOR.text, width: 180 }}
            />
          </label>
          {/* Cards / List toggle */}
          <div style={{ display: 'flex', border: `1px solid ${COLOR.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {(['cards', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  background: viewMode === mode ? COLOR.accentSoft : COLOR.surface,
                  color: viewMode === mode ? COLOR.accent : COLOR.textSecondary,
                }}
              >
                {mode === 'cards' ? <LayoutGrid size={14} strokeWidth={2} /> : <List size={14} strokeWidth={2} />}
                {mode === 'cards' ? 'Cards' : 'List'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid / List */}
      <div className={viewMode === 'cards' ? 'mc-panels-grid' : 'mc-panels-list'}>
        {filtered.map((condition) => {
          const meta = getPanelMeta(condition.name);
          const Icon = meta.icon;
          const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(condition.name));
          const observations = condition.tests.filter((t) => !INDEX_LOINCS.has(t.loinc));

          // Tested count
          const obsTotal = observations.length;
          const obsTested = observations.filter((t) => getStatus(latestByLoinc, testLoincs(t)) !== 'never').length;
          const idxTotal = computedForPanel.length;
          const idxTested = computedForPanel.filter((def) => latestZone(def, datesDesc, resultsByDate) != null).length;
          const total = obsTotal + idxTotal;
          const tested = obsTested + idxTested;

          return (
            <div
              key={condition.name}
              className="mc-panel-card"
              style={{ padding: 0, overflow: 'hidden', background: COLOR.surface, display: 'flex', flexDirection: 'column' }}
            >
              {/* Card header */}
              <div
                {...pressable(() => onOpenDetail(condition.name))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', cursor: 'pointer',
                  background: `${meta.color}0c`,
                  borderBottom: `1px solid ${COLOR.borderSubtle}`,
                }}
              >
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 42, height: 42, borderRadius: '50%',
                  background: `${meta.color}22`, flexShrink: 0,
                }}>
                  <Icon size={20} color={meta.color} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.text }}>{condition.name}</div>
                  {meta.description && (
                    <div style={{ fontSize: 12, color: COLOR.textSecondary, marginTop: 1 }}>{meta.description}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.text }}>{tested} / {total}</div>
                  <div style={{ fontSize: 11, color: COLOR.textMuted }}>tested</div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Observations */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLOR.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                    Observations
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 8px' }}>
                    {observations.map((test) => {
                      const status = getStatus(latestByLoinc, testLoincs(test)) as Status;
                      return (
                        <DotItem
                          key={test.loinc}
                          label={test.short}
                          dotColor={STATUS_STYLES[status].border}
                          onClick={(e) => onOpenPopup(test, e)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Indices */}
                {computedForPanel.length > 0 && (
                  <div style={{ borderTop: `1px solid ${COLOR.borderSubtle}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLOR.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                      Indices
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 8px' }}>
                      {computedForPanel.map((def) => {
                        const z = latestZone(def, datesDesc, resultsByDate);
                        const dotColor = z ? ZONE_DOT[z] : STATUS_STYLES.never.border;
                        return (
                          <DotItem
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
              </div>

              {/* View details link */}
              <div
                {...pressable(() => onOpenDetail(condition.name))}
                style={{
                  padding: '8px 16px 12px',
                  display: 'flex', justifyContent: 'flex-end',
                  fontSize: 13, fontWeight: 600, color: COLOR.accent,
                  cursor: 'pointer', borderTop: `1px solid ${COLOR.borderSubtle}`,
                  gap: 4,
                }}
              >
                View details →
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 28, flexWrap: 'wrap' }}>
        <LegendItem color={STATUS_STYLES['in-range'].border} label="In range" />
        <LegendItem color={STATUS_STYLES['unknown'].border} label="Borderline" />
        <LegendItem color={STATUS_STYLES['out-of-range'].border} label="Out of range" />
        <LegendItem color={STATUS_STYLES['never'].border} label="Not tested" />
      </div>
    </>
  );
}
