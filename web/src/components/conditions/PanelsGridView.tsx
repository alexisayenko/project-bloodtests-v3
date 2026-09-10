import { useMemo } from 'react';
import { computeIndex, zone, type IndexDef, type Zone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import type { Result } from '../../types';
import { INDEX_LOINCS, testLoincs, type Observation } from './markers';
import { STATUS_STYLES, ZONE_DOT, pressable } from './ui';
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

/** A small rounded chip for one marker or index. */
function Chip({
  label,
  dotColor,
  onClick,
}: Readonly<{ label: string; dotColor: string; onClick: (e: { currentTarget: HTMLElement }) => void }>) {
  return (
    <div
      {...pressable(onClick)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        borderRadius: 9999,
        background: COLOR.surfaceMuted,
        border: `1px solid ${COLOR.borderSubtle}`,
        fontSize: 12,
        fontWeight: 500,
        color: COLOR.text,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
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
            <div key={condition.name} className="mc-panel-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Card header */}
              <div
                {...pressable(() => onOpenDetail(condition.name))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: `${meta.color}14`, // ~8% opacity tint
                  cursor: 'pointer',
                  borderBottom: `1px solid ${meta.color}30`,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: meta.color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} color="#fff" strokeWidth={2} aria-hidden="true" />
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLOR.text, flex: 1, lineHeight: 1.3 }}>
                  {condition.name}
                </span>
                <span style={{ color: meta.color, fontSize: 16, fontWeight: 400 }}>›</span>
              </div>

              {/* Marker chips */}
              <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {observations.map((test) => {
                  const dotColor = STATUS_STYLES[getStatus(latestByLoinc, testLoincs(test))].border;
                  return (
                    <Chip
                      key={test.loinc}
                      label={test.short}
                      dotColor={dotColor}
                      onClick={(e) => onOpenPopup(test, e)}
                    />
                  );
                })}
                {computedForPanel.map((def) => {
                  const z = latestZone(def, datesDesc, resultsByDate);
                  const dotColor = z ? ZONE_DOT[z] : STATUS_STYLES.never.border;
                  return (
                    <Chip
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
