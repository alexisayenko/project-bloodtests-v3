import { useMemo, useState } from 'react';
import { BarChart2, Calculator, Link2, Search } from 'lucide-react';
import { computeIndex, zone, type IndexDef, type Zone } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import type { Result } from '../../types';
import { INDEX_LOINCS, testLoincs, observationMatchesQuery, indexMatchesQuery, type Observation } from './markers';
import { pressable } from './ui';
import { getStatus, type LatestByLoinc, type Status } from './resultsLookup';
import { COLOR, RADIUS } from '../../styles/tokens';
import { getPanelMeta } from './panelMeta';
import { PageHeader } from './PageHeader';
import { StatusChip, StatusLegend, type StatusTone } from '../primitives';

export type Condition = { name: string; tests: Observation[] };

// A reading without a reference range reads as borderline: measured, but not placeable.
const STATUS_TONE: Record<Status, StatusTone> = {
  'in-range': 'ok',
  'out-of-range': 'bad',
  unknown: 'warn',
  never: 'none',
};

const SECTION_LABEL = { fontSize: 13, fontWeight: 600, color: COLOR.text, lineHeight: 1.4 } as const;
const CHIP_ROW = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 } as const;

/** Newest-first scan for the first draw with a computable value. */
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

      <div className="mc-panels-toolbar">
        <StatusLegend />
        <label className="mc-panels-search" style={{ borderRadius: RADIUS.control }}>
          <Search size={16} color={COLOR.textMuted} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search markers or panels…"
            aria-label="Search markers or panels"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

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
              style={{ background: meta.bgColor, border: `1px solid ${meta.borderColor}`, borderRadius: RADIUS.card }}
            >
              <div {...pressable(() => onOpenDetail(condition.name))} className="mc-panel-head">
                <span className="mc-panel-icon" style={{ background: meta.iconBg, color: meta.color }}>
                  <Icon size={30} color="currentColor" strokeWidth={2} aria-hidden="true" />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mc-panel-title">{condition.name}</div>
                  {meta.description && <div className="mc-panel-desc">{meta.description}</div>}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <div style={SECTION_LABEL}>Observations</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: COLOR.textMuted, flexShrink: 0 }}>
                    {observations.length} markers
                  </div>
                </div>
                <div style={CHIP_ROW}>
                  {observations.map((test) => (
                    <StatusChip
                      key={test.loinc}
                      label={test.full}
                      tone={STATUS_TONE[getStatus(latestByLoinc, testLoincs(test))]}
                      onClick={(e) => onOpenPopup(test, e)}
                    />
                  ))}
                </div>
              </div>

              {computedForPanel.length > 0 && (
                <div style={{ borderTop: `1px solid ${meta.borderColor}`, paddingTop: 16 }}>
                  <div style={SECTION_LABEL}>Indices</div>
                  <div style={CHIP_ROW}>
                    {computedForPanel.map((def) => (
                      <StatusChip
                        key={def.key}
                        label={def.nameCompact}
                        tone={latestZone(def, datesDesc, resultsByDate) ?? 'none'}
                        onClick={(e) => onOpenIndexPopup(def, e)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                <span {...pressable(() => onOpenDetail(condition.name))} className="mc-panel-link">
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
