import { useMemo } from 'react';
import { INDEX_DEFS, computeIndex, zone, type IndexDef, type Zone } from '../../data/computedIndices';
import type { Result } from '../../types';
import { INDEX_LOINCS, testLoincs, type Observation } from './markers';
import { STATUS_STYLES, ZONE_DOT, pressable } from './ui';
import { getStatus, type LatestByLoinc } from './resultsLookup';

export type Condition = { name: string; tests: Observation[] };

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 0',
  borderBottom: '1px solid #eee',
  fontSize: 13,
  cursor: 'pointer',
} as const;

// Status is conveyed by a small colored dot next to the label instead of a
// filled/bordered pill, so the label text stays legible dark text even for a
// 'never' (no result on file) status -- a pill's `STATUS_STYLES['never']`
// (grey border+background+text) could wash out to near-invisible against
// the card's white background. Shared by both the observations list and the
// computed-indices list below it, so the two groups read as one dot language.
function DotRow({
  color,
  label,
  onClick,
}: Readonly<{ color: string; label: string; onClick: (e: { currentTarget: HTMLElement }) => void }>) {
  return (
    <div {...pressable(onClick)} style={rowStyle}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: '#1a1a1a' }}>{label}</span>
    </div>
  );
}

/** Newest-first scan for the first draw with a computable value, same as Popup.tsx's IndexPopupBody. */
function latestZone(def: IndexDef, datesDesc: string[], resultsByDate: Record<string, Record<string, Result>>): Zone | null {
  for (const date of datesDesc) {
    const value = computeIndex(def, resultsByDate[date]!);
    if (value != null) return zone(value, def.cut[0], def.cut[1], def.hi);
  }
  return null;
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
  // Sorted once and reused for every panel's indices, instead of re-sorting
  // the same date keys per index.
  const datesDesc = useMemo(() => Object.keys(resultsByDate).sort((a, b) => b.localeCompare(a)), [resultsByDate]);

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>Monitoring Panels</h1>
      <div className="mc-panels-grid">
        {conditions.map((condition) => {
          const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(condition.name));
          return (
            <div key={condition.name} className="mc-panel-card">
              <div
                {...pressable(() => onOpenDetail(condition.name))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  paddingBottom: 10,
                  marginBottom: 16,
                  borderBottom: '1.5px solid #1971c2',
                  cursor: 'pointer',
                }}
              >
                {condition.name}
                <span style={{ color: '#1971c2', fontWeight: 400 }}>›</span>
              </div>
              <div className="mc-panel-dots">
                {condition.tests
                  .filter((test) => !INDEX_LOINCS.has(test.loinc))
                  .map((test) => {
                    const style = STATUS_STYLES[getStatus(latestByLoinc, testLoincs(test))];
                    return <DotRow key={test.loinc} color={style.border} label={test.short} onClick={(e) => onOpenPopup(test, e)} />;
                  })}
              </div>
              {computedForPanel.length > 0 && (
                <div
                  className="mc-panel-dots"
                  style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #cfe2f3' }}
                >
                  {computedForPanel.map((def) => {
                    const z = latestZone(def, datesDesc, resultsByDate);
                    const color = z ? ZONE_DOT[z] : STATUS_STYLES.never.border;
                    return <DotRow key={def.key} color={color} label={def.nameCompact} onClick={(e) => onOpenIndexPopup(def, e)} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
