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
import { StatusChip, SwitchToggle, type StatusTone } from '../primitives';
import { StatusFilterBar } from './StatusFilterBar';
import { ALL_TONES, countTones, filterByTone, isToneFilterActive, markerCountLabel, type Toned } from './statusFilter';

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
const CHIP_ROW_COMPACT = { ...CHIP_ROW, gap: 6, marginTop: 0 } as const;

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
  compact,
  onCompactChange,
  onOpenDetail,
  onOpenPopup,
  onOpenIndexPopup,
}: Readonly<{
  conditions: Condition[];
  latestByLoinc: LatestByLoinc;
  resultsByDate: Record<string, Record<string, Result>>;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
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

  const panels = useMemo(
    () =>
      filtered.map((condition) => ({
        condition,
        observations: condition.tests
          .filter((t) => !INDEX_LOINCS.has(t.loinc))
          .map((test): Toned<Observation> => ({ item: test, tone: STATUS_TONE[getStatus(latestByLoinc, testLoincs(test))] })),
        indices: INDEX_DEFS.filter((d) => d.panels.includes(condition.name)).map(
          (def): Toned<IndexDef> => ({ item: def, tone: latestZone(def, datesDesc, resultsByDate) ?? 'none' }),
        ),
      })),
    [filtered, latestByLoinc, datesDesc, resultsByDate],
  );

  const [activeTones, setActiveTones] = useState<ReadonlySet<StatusTone>>(ALL_TONES);
  const toneFiltered = isToneFilterActive(activeTones);
  const toneCounts = useMemo(
    () => countTones(panels.flatMap((p) => [...p.observations, ...p.indices].map((chip) => chip.tone))),
    [panels],
  );

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
        <StatusFilterBar active={activeTones} counts={toneCounts} onChange={setActiveTones} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <SwitchToggle label="Compact view" pressed={compact} onChange={onCompactChange} />
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
      </div>

      <div className={compact ? 'mc-panels-grid mc-panels-grid--compact' : 'mc-panels-grid'}>
        {panels.map(({ condition, observations, indices }) => {
          const meta = getPanelMeta(condition.name);
          const Icon = meta.icon;
          const visibleObservations = filterByTone(observations, activeTones);
          const visibleIndices = filterByTone(indices, activeTones);
          const nothingMatches = toneFiltered && visibleObservations.length + visibleIndices.length === 0;
          const chipRow = compact ? CHIP_ROW_COMPACT : CHIP_ROW;
          const showObservations = !compact || visibleObservations.length > 0 || nothingMatches;

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
                <div className="mc-panel-count">
                  {markerCountLabel(visibleObservations.length, observations.length, toneFiltered)}
                </div>
              </div>

              <div hidden={!showObservations}>
                {!compact && <div style={SECTION_LABEL}>Observations</div>}
                {visibleObservations.length > 0 && (
                  <div style={chipRow}>
                    {visibleObservations.map(({ item: test, tone }) => (
                      <StatusChip
                        key={test.loinc}
                        label={compact ? test.shortName : test.friendlyName}
                        tone={tone}
                        onClick={(e) => onOpenPopup(test, e)}
                      />
                    ))}
                  </div>
                )}
                {nothingMatches && (
                  <div style={{ marginTop: compact ? 0 : 10, fontSize: 13, color: COLOR.textMuted }}>No markers match</div>
                )}
              </div>

              {visibleIndices.length > 0 && (
                <div style={showObservations ? { borderTop: `1px solid ${meta.borderColor}`, paddingTop: 16 } : undefined}>
                  {!compact && <div style={SECTION_LABEL}>Indices</div>}
                  <div style={chipRow}>
                    {visibleIndices.map(({ item: def, tone }) => (
                      <StatusChip
                        key={def.key}
                        label={compact ? def.shortName : def.friendlyName}
                        tone={tone}
                        onClick={(e) => onOpenIndexPopup(def, e)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!compact && (
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                  <span {...pressable(() => onOpenDetail(condition.name))} className="mc-panel-link">
                    View panel →
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
