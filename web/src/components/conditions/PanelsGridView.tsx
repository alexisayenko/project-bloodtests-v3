import { useMemo } from 'react';
import { computeIndex, zone, type IndexDef, type Zone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import type { Result } from '../../types';
import { INDEX_LOINCS, type Observation } from './markers';
import { pressable } from './ui';
import type { LatestByLoinc } from './resultsLookup';
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

/** White rounded-rectangle chip — bold label. */
function Chip({
  label,
  onClick,
}: Readonly<{ label: string; onClick: (e: { currentTarget: HTMLElement }) => void }>) {
  return (
    <div
      {...pressable(onClick)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 10px',
        borderRadius: 12,
        background: COLOR.surface,
        fontSize: 13,
        fontWeight: 600,
        color: COLOR.text,
        cursor: 'pointer',
        textAlign: 'center',
        lineHeight: 1.2,
      }}
    >
      {label}
    </div>
  );
}

export function PanelsGridView({
  conditions,
  latestByLoinc: _latestByLoinc, // kept for API compatibility; status coloring deferred
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
  const datesDesc = useMemo(() => Object.keys(resultsByDate).sort((a, b) => b.localeCompare(a)), [resultsByDate]);

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 32, letterSpacing: -0.3 }}>Monitoring Panels</h1>
      <div className="mc-panels-grid">
        {conditions.map((condition) => {
          const meta = getPanelMeta(condition.name);
          const Icon = meta.icon;
          const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(condition.name));
          const observations = condition.tests.filter((t) => !INDEX_LOINCS.has(t.loinc));

          return (
            <div
              key={condition.name}
              className="mc-panel-card"
              style={{ padding: '16px', background: `${meta.color}0f`, overflow: 'hidden' }}
            >
              {/* Header: icon + name + description */}
              <div
                {...pressable(() => onOpenDetail(condition.name))}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, cursor: 'pointer' }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: `${meta.color}22`,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} color={meta.color} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.text, lineHeight: 1.3 }}>
                    {condition.name}
                  </div>
                  {meta.description && (
                    <div style={{ fontSize: 13, color: COLOR.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
                      {meta.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Marker + index chips — 3 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {observations.map((test) => (
                  <Chip key={test.loinc} label={test.short} onClick={(e) => onOpenPopup(test, e)} />
                ))}
                {computedForPanel.map((def) => {
                  latestZone(def, datesDesc, resultsByDate); // compute for future status use
                  return (
                    <Chip key={def.key} label={def.nameCompact} onClick={(e) => onOpenIndexPopup(def, e)} />
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
