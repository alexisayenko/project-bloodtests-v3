import { useMemo, useState, useEffect } from 'react';
import { useData } from '../../data/DataContext';
import { useResultsContext } from '../../data/ResultsContext';
import { fmtNum, formatResultReference, isOutOfRange } from '../../utils/format';
import { INDEX_DEFS, MARKER_LOINC, SI_US_UNIT, computeIndex, toUnit, zone, type IndexDef } from '../../data/computedIndices';
import type { Result } from '../../types';
import { generateTestData } from '../../data/generateTestData';
import {
  PANEL_DEFS, SHORT_LABELS, ALSO_REFS, ALIAS_TO_PRIMARY, INDEX_LOINCS, COMPUTED_LOINCS,
  LOINC_TO_MARKER, getPanelLoincs, testLoincs, isEchoRedundant, type Observation,
} from './markers';
import { NAV_ITEMS, routeToHash, hashToRoute, type Route } from './routing';
import { ReferenceBookPage } from './ReferenceBookPage';
import {
  STATUS_STYLES, ZONE_BG, SELECTED_ZONE_BG, BADGE_WIDTH, BADGE_GAP, PANEL_PADDING, PANEL_GAP,
  PANEL_WIDTH, POPUP_WIDTH, INDEX_POPUP_WIDTH, ANALYSIS_SETTINGS_KEY, formatMonthYear,
  greenRangeOf, loadAnalysisSettings,
} from './ui';

type PopupPosition = { left: number; top?: number; bottom?: number };
type PopupState =
  | ({ kind: 'observation'; test: Observation } & PopupPosition)
  | ({ kind: 'index'; def: IndexDef } & PopupPosition);

export function MedicalConditionsPage() {
  const { analysesCatalog, panels } = useData();
  const { sessions, loadGroupItems, loadGenerated, uploadFile, clearData, error: uploadError } = useResultsContext();
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [selectedLoinc, setSelectedLoinc] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));
  const [detailTab, setDetailTab] = useState<'analysis' | 'in-range'>('analysis');
  const [unitSystem, setUnitSystem] = useState<'si' | 'us'>(() => loadAnalysisSettings().unitSystem);
  const [sampleLimit, setSampleLimit] = useState<number | 'all'>(() => loadAnalysisSettings().sampleLimit);
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>(() => loadAnalysisSettings().dateOrder);
  const [allResults, setAllResults] = useState<{ loinc: string; date: string; result: Result }[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(ANALYSIS_SETTINGS_KEY, JSON.stringify({ unitSystem, sampleLimit, dateOrder }));
    } catch {
      // storage unavailable (private browsing, quota) -- setting just won't persist
    }
  }, [unitSystem, sampleLimit, dateOrder]);

  const conditions = useMemo(() => {
    return PANEL_DEFS.map((def) => {
      let loincs: string[];
      if (def.panelIds) {
        loincs = def.panelIds.flatMap((id) => {
          const panel = panels.find((p) => p.id === id);
          return panel ? getPanelLoincs(panel) : [];
        });
      } else if (def.panelId) {
        const panel = panels.find((p) => p.id === def.panelId);
        loincs = panel ? getPanelLoincs(panel) : [];
      } else {
        loincs = def.loincs ?? [];
      }
      if (def.excludeLoincs) {
        loincs = loincs.filter((loinc) => !def.excludeLoincs!.includes(loinc));
      }
      loincs = [...loincs, ...(def.extraLoincs ?? [])];
      const tests: Observation[] = loincs.map((loinc) => {
        const analysis = analysesCatalog[loinc];
        const labelInfo = SHORT_LABELS[loinc];
        return {
          short: labelInfo?.short ?? analysis?.displayName ?? loinc,
          full: analysis?.displayName ?? loinc,
          longCommonName: analysis?.longCommonName ?? '',
          loinc,
          unit: labelInfo?.unit,
          also: ALSO_REFS[loinc],
        };
      });
      return { name: def.name, tests };
    });
  }, [panels, analysesCatalog]);

  useEffect(() => {
    // The single source of truth for the current route is always the URL, so
    // back/forward -- browser buttons or in-app links -- stay in sync by
    // construction, and any open popup (a transient overlay, not a page) is
    // always dropped on navigation instead of surviving over the new view.
    const onPopState = () => {
      setPopup(null);
      setRoute(hashToRoute(window.location.hash));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: Route) => {
    window.history.pushState(null, '', routeToHash(next));
    setPopup(null);
    setRoute(next);
  };

  const openDetail = (name: string) => {
    navigate({ view: 'panel', name });
    setDetailTab('analysis');
  };

  const openReference = (key?: string) => navigate({ view: 'reference', key });

  const navEl = (
    <div style={{ display: 'flex', gap: 32, marginBottom: 32, borderBottom: '1.5px solid #eee' }}>
      {NAV_ITEMS.map((item) => {
        const active = route.view === item.view || (item.view === 'panels' && route.view === 'panel');
        return (
          <div
            key={item.view}
            onClick={() => navigate({ view: item.view })}
            style={{
              padding: '12px 2px',
              marginBottom: -1.5,
              borderBottom: active ? '2px solid #1971c2' : '2px solid transparent',
              fontSize: 15,
              fontWeight: active ? 600 : 400,
              color: active ? '#1971c2' : '#555',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );

  // Shared table controls (unit system, samplings shown, column order) — one
  // setting across the panel Analysis tables and All Observations alike.
  const controlsEl = (
    <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Unit system</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['si', 'us'] as const).map((sys) => (
            <div
              key={sys}
              onClick={() => setUnitSystem(sys)}
              style={{
                padding: '4px 12px',
                borderRadius: 9999,
                border: '1.5px solid #1971c2',
                background: unitSystem === sys ? '#1971c2' : 'transparent',
                color: unitSystem === sys ? '#fff' : '#1971c2',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {sys.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Last N samplings</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([5, 10, 15, 'all'] as const).map((n) => (
            <div
              key={n}
              onClick={() => setSampleLimit(n)}
              style={{
                padding: '4px 12px',
                borderRadius: 9999,
                border: '1.5px solid #1971c2',
                background: sampleLimit === n ? '#1971c2' : 'transparent',
                color: sampleLimit === n ? '#fff' : '#1971c2',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {n === 'all' ? 'All' : n}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Column order</div>
        <div
          onClick={() => setDateOrder(dateOrder === 'desc' ? 'asc' : 'desc')}
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 9999,
            border: '1.5px solid #1971c2',
            color: '#1971c2',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {dateOrder === 'desc' ? 'Newest → Oldest' : 'Oldest → Newest'}
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    let cancelled = false;

    async function buildAllResults() {
      const all: { loinc: string; date: string; result: Result }[] = [];
      for (const session of sessions) {
        const items = session.items ?? (await loadGroupItems(session.file));
        for (const item of items) {
          all.push({ loinc: item.loinc, date: session.date, result: item });
        }
      }
      if (!cancelled) setAllResults(all);
    }

    buildAllResults();
    return () => {
      cancelled = true;
    };
  }, [sessions, loadGroupItems]);

  const latestByLoinc = useMemo(() => {
    const map: Record<string, { result: Result; date: string }> = {};
    for (const { loinc, date, result } of allResults) {
      const existing = map[loinc];
      if (!existing || date > existing.date) map[loinc] = { result, date };
    }
    return map;
  }, [allResults]);

  // Per-date lookup for computed indices: { date: { loinc: Result } }.
  const resultsByDate = useMemo(() => {
    const map: Record<string, Record<string, Result>> = {};
    for (const { loinc, date, result } of allResults) {
      (map[date] ??= {})[loinc] = result;
    }
    return map;
  }, [allResults]);

  const latestIndexValue = (def: IndexDef): { value: number; date: string } | null => {
    const dates = Object.keys(resultsByDate).sort((a, b) => b.localeCompare(a));
    for (const date of dates) {
      const value = computeIndex(def, resultsByDate[date]!);
      if (value != null) return { value, date };
    }
    return null;
  };

  const popupPosition = (rect: DOMRect, width: number): PopupPosition => {
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(center - width / 2, 8), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Open upward when there's little room below and more room above --
    // keeps the popup from running off the bottom of the viewport for a
    // row near the end of a long page.
    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      return { left, bottom: window.innerHeight - rect.top + 8 };
    }
    return { left, top: rect.bottom + 8 };
  };

  const openPopup = (test: Observation, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ kind: 'observation', test, ...popupPosition(rect, POPUP_WIDTH) });
  };

  const openIndexPopup = (def: IndexDef, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ kind: 'index', def, ...popupPosition(rect, INDEX_POPUP_WIDTH) });
  };

  const getLatest = (loincs: string[]): { result: Result; date: string } | null => {
    let current: { result: Result; date: string } | null = null;
    for (const loinc of loincs) {
      const candidate = latestByLoinc[loinc];
      if (candidate && (!current || candidate.date > current.date)) current = candidate;
    }
    return current;
  };

  type Status = 'never' | 'in-range' | 'out-of-range' | 'unknown';
  const getStatus = (loincs: string[]): Status => {
    const current = getLatest(loincs);
    if (!current) return 'never';
    const hasRef = current.result.value != null && (current.result.refMin != null || current.result.refMax != null);
    if (!hasRef) return 'unknown';
    return isOutOfRange(current.result) ? 'out-of-range' : 'in-range';
  };

  const renderLatest = (loincs: string[]) => {
    const current = getLatest(loincs);
    if (!current) {
      return (
        <div style={{ fontSize: 13, color: '#888', marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
          Never taken
        </div>
      );
    }
    const value = current.result.rawValue || fmtNum(current.result.value);
    const hasRef = current.result.value != null && (current.result.refMin != null || current.result.refMax != null);
    const bg = hasRef ? (isOutOfRange(current.result) ? '#fdecea' : '#e6f4ea') : 'transparent';
    return (
      <div style={{ fontSize: 13, color: '#555', marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
        <div style={{ fontWeight: 500, color: '#333' }}>Latest taken on {formatMonthYear(current.date)}</div>
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: bg }}>
          {value} {current.result.unit}
          <span style={{ color: '#888' }}> (Ref: {formatResultReference(current.result)})</span>
        </div>
      </div>
    );
  };

  const popupEl = popup && (
    <>
      <div onClick={() => setPopup(null)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
      <div
        style={{
          position: 'fixed',
          top: popup.top,
          bottom: popup.bottom,
          left: popup.left,
          background: '#fff',
          border: '1.5px solid #1971c2',
          borderRadius: 12,
          padding: 18,
          width: popup.kind === 'index' ? INDEX_POPUP_WIDTH : POPUP_WIDTH,
          // Cap to whatever room is actually left on the anchored side, not just
          // the viewport height -- otherwise a popup opened partway down the
          // page can still try to render taller than the space below it.
          maxHeight: popup.top != null ? `calc(100vh - ${popup.top}px - 8px)` : `calc(100vh - ${popup.bottom}px - 8px)`,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          boxSizing: 'border-box',
          zIndex: 101,
        }}
      >
        {popup.kind === 'observation' ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {popup.test.full}
              {!isEchoRedundant(popup.test.full, popup.test.short) && ` (${popup.test.short})`}
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: popup.test.also ? 10 : 0 }}>
              <a
                href={`https://loinc.org/${popup.test.loinc}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: 'monospace', color: '#1971c2' }}
              >
                {popup.test.loinc}
              </a>{' '}
              {popup.test.longCommonName}
              {popup.test.unit ? `, ${popup.test.unit}` : ''}
            </div>
            {popup.test.also?.map((ref) => (
              <div key={ref.loinc} style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
                <a
                  href={`https://loinc.org/${ref.loinc}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily: 'monospace', color: '#1971c2' }}
                >
                  {ref.loinc}
                </a>{' '}
                {ref.longCommonName}, {ref.unit}
              </div>
            ))}
            {renderLatest([popup.test.loinc, ...(popup.test.also?.map((ref) => ref.loinc) ?? [])])}
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              {popup.def.name}
              {!isEchoRedundant(popup.def.name, popup.def.nameCompact) && ` (${popup.def.nameCompact})`}
            </div>
            <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-line', marginBottom: 10 }}>{popup.def.formula}</div>
            {(() => {
              const latest = latestIndexValue(popup.def);
              const reported = popup.def.loinc ? latestByLoinc[popup.def.loinc] : undefined;
              return (
                <>
                  <div style={{ fontSize: 13, color: '#555', paddingTop: 8, borderTop: '1px solid #eee' }}>
                    {latest ? (
                      <>
                        <div style={{ fontWeight: 500, color: '#333' }}>Calculated, {formatMonthYear(latest.date)}</div>
                        <div
                          style={{
                            marginTop: 4,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: ZONE_BG[zone(latest.value, popup.def.cut[0], popup.def.cut[1], popup.def.hi)],
                          }}
                        >
                          {fmtNum(latest.value)} {popup.def.unit ?? ''}
                          <span style={{ color: '#888' }}> (Ref: {greenRangeOf(popup.def)})</span>
                        </div>
                      </>
                    ) : (
                      'Not enough data to calculate yet'
                    )}
                  </div>
                  {reported && (
                    <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
                      <div style={{ fontWeight: 500, color: '#333' }}>Lab reported, {formatMonthYear(reported.date)}</div>
                      <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: '#f5f5f5' }}>
                        {reported.result.rawValue || fmtNum(reported.result.value)} {reported.result.unit}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            <div style={{ fontSize: 13, color: '#333', marginTop: 10 }}>{popup.def.meaning}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{popup.def.evidenceLevel}</span>
              {popup.def.references[0] && ` -- ${popup.def.references[0].organization}`}
            </div>
            <div
              onClick={() => openReference(popup.def.key)}
              style={{ fontSize: 13, color: '#1971c2', fontWeight: 500, marginTop: 10, cursor: 'pointer' }}
            >
              Learn more →
            </div>
          </>
        )}
      </div>
    </>
  );

  if (route.view === 'all') {
    // Every distinct observation ever uploaded, regardless of panel membership.
    // A result recorded under an also-ref alias (unit-variant LOINC) folds into
    // its primary marker's row instead of appearing as a bare-LOINC duplicate.
    const seen = new Map<string, Observation>();
    for (const { loinc: rawLoinc } of allResults) {
      const loinc = ALIAS_TO_PRIMARY[rawLoinc] ?? rawLoinc;
      if (seen.has(loinc)) continue;
      const analysis = analysesCatalog[loinc];
      const labelInfo = SHORT_LABELS[loinc];
      seen.set(loinc, {
        short: labelInfo?.short ?? analysis?.displayName ?? loinc,
        full: analysis?.displayName ?? loinc,
        longCommonName: analysis?.longCommonName ?? '',
        loinc,
        unit: labelInfo?.unit,
        also: ALSO_REFS[loinc],
      });
    }
    const rows = Array.from(seen.values()).sort((a, b) => a.short.localeCompare(b.short));
    const sortedDates = Array.from(new Set(allResults.map((r) => r.date))).sort((a, b) => b.localeCompare(a));
    const recentDates = sampleLimit === 'all' ? sortedDates : sortedDates.slice(0, sampleLimit);
    const allDates = dateOrder === 'asc' ? [...recentDates].reverse() : recentDates;

    return (
      <div style={{ padding: '56px 48px' }}>
        {navEl}
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>All Observations</h1>
        {rows.length === 0 ? (
          <div style={{ color: '#888', fontSize: 14 }}>No results uploaded yet.</div>
        ) : (
          <>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              {rows.length} observations across {sortedDates.length} lab reports
            </div>
            {controlsEl}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 140, textAlign: 'left', padding: '8px 12px', borderBottom: '1.5px solid #1971c2', whiteSpace: 'nowrap' }}>
                      Observations
                    </th>
                    {allDates.map((date) => (
                      <th key={date} style={{ width: 96, textAlign: 'left', padding: '8px 12px', borderBottom: '1.5px solid #1971c2', whiteSpace: 'nowrap' }}>
                        {formatMonthYear(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((test) => {
                    const selected = selectedLoinc === test.loinc;
                    const marker = LOINC_TO_MARKER[test.loinc];
                    const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
                    const displayUnit = siUsUnit ? siUsUnit[unitSystem] : test.unit;
                    return (
                      <tr key={test.loinc} style={{ background: selected ? '#eaf3fb' : undefined }}>
                        <td
                          onClick={(e) => {
                            setSelectedLoinc(test.loinc);
                            openPopup(test, e);
                          }}
                          style={{ width: 140, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >
                          <span style={{ fontWeight: 600 }}>{test.short}</span>
                          {displayUnit && `, ${displayUnit}`}
                        </td>
                        {allDates.map((date) => {
                          const rowLoincs = testLoincs(test);
                          const match = allResults.find((r) => r.date === date && rowLoincs.includes(r.loinc)) ?? null;
                          if (!match) {
                            return (
                              <td
                                key={date}
                                onClick={() => setSelectedLoinc(test.loinc)}
                                style={{ width: 96, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                              >
                                –
                              </td>
                            );
                          }
                          const hasRef = match.result.value != null && (match.result.refMin != null || match.result.refMax != null);
                          const bg = hasRef
                            ? (isOutOfRange(match.result) ? (selected ? '#e6e8f0' : '#fdecea') : (selected ? '#dbecf0' : '#e6f4ea'))
                            : (selected ? '#eaf3fb' : 'transparent');
                          const displayValue =
                            siUsUnit && match.result.value != null
                              ? toUnit(match.result.value, marker!, match.result.unit, siUsUnit[unitSystem])
                              : match.result.value;
                          return (
                            <td
                              key={date}
                              onClick={() => setSelectedLoinc(test.loinc)}
                              style={{ width: 96, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', background: bg, cursor: 'pointer' }}
                            >
                              {siUsUnit ? fmtNum(displayValue) : match.result.rawValue || fmtNum(match.result.value)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {popupEl}
      </div>
    );
  }

  if (route.view === 'profile') {
    return (
      <div style={{ padding: '56px 48px' }}>
        {navEl}
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>Profile</h1>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <label
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: 9999,
              border: '1.5px solid #1971c2',
              background: '#1971c2',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Upload JSON
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
                e.target.value = '';
              }}
            />
          </label>
          <div
            onClick={() => loadGenerated(generateTestData())}
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: 9999,
              border: '1.5px solid #1971c2',
              color: '#1971c2',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Generate Test Data
          </div>
          <div
            onClick={() => {
              if (window.confirm('Remove all loaded lab reports?')) clearData();
            }}
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: 9999,
              border: '1.5px solid #ea4335',
              color: '#ea4335',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear
          </div>
        </div>
        {uploadError && <div style={{ color: '#ea4335', fontSize: 14, marginBottom: 12 }}>{uploadError}</div>}
        <div style={{ color: '#888', fontSize: 14 }}>
          Upload a lab-results JSON export, or add 6 randomly generated lab reports. Both merge with whatever is
          already loaded ({sessions.length} report{sessions.length === 1 ? '' : 's'} currently).
        </div>
        {popupEl}
      </div>
    );
  }

  if (route.view === 'reference') {
    return (
      <div style={{ padding: '56px 48px' }}>
        {navEl}
        <ReferenceBookPage indexKey={route.key} navigate={navigate} />
        {popupEl}
      </div>
    );
  }

  if (route.view === 'panel') {
    const detailPanel = route.name;
    const condition = conditions.find((c) => c.name === detailPanel);
    const tests = condition?.tests ?? [];
    const observations = tests.filter((t) => !INDEX_LOINCS.has(t.loinc));
    const indices = tests.filter((t) => INDEX_LOINCS.has(t.loinc) && !COMPUTED_LOINCS.has(t.loinc));
    const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(detailPanel));
    const computedInputLoincs = new Set(
      computedForPanel.flatMap((d) => d.needs.flatMap((short) => MARKER_LOINC[short] ?? []))
    );

    const dates = Array.from(
      new Set(
        allResults
          .filter((r) => tests.some((t) => testLoincs(t).includes(r.loinc)) || computedInputLoincs.has(r.loinc))
          .map((r) => r.date)
      )
    ).sort((a, b) => b.localeCompare(a));

    const recentDates = sampleLimit === 'all' ? dates : dates.slice(0, sampleLimit);
    const visibleDates = dateOrder === 'asc' ? [...recentDates].reverse() : recentDates;

    const cellMatch = (test: Observation, date: string) => {
      const loincs = testLoincs(test);
      return allResults.find((r) => r.date === date && loincs.includes(r.loinc)) ?? null;
    };

    const DATE_COL_WIDTH = 96;
    // Shared across observations and both indices tables so they line up as one block.
    const LABEL_COL_WIDTH = 140;

    const renderTable = (rowTests: Observation[], label: string) => (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: LABEL_COL_WIDTH, textAlign: 'left', padding: '8px 12px', borderBottom: '1.5px solid #1971c2', whiteSpace: 'nowrap' }}>
                {label}
              </th>
              {visibleDates.map((date) => (
                <th
                  key={date}
                  style={{
                    width: DATE_COL_WIDTH,
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderBottom: '1.5px solid #1971c2',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatMonthYear(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowTests.map((test) => {
              const selected = selectedLoinc === test.loinc;
              const marker = LOINC_TO_MARKER[test.loinc];
              const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
              const displayUnit = siUsUnit ? siUsUnit[unitSystem] : test.unit;
              return (
              <tr key={test.loinc} style={{ background: selected ? '#eaf3fb' : undefined }}>
                <td
                  onClick={(e) => {
                    setSelectedLoinc(test.loinc);
                    openPopup(test, e);
                  }}
                  style={{ width: LABEL_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 600 }}>{test.short}</span>
                  {displayUnit && `, ${displayUnit}`}
                </td>
                {visibleDates.map((date) => {
                  const match = cellMatch(test, date);
                  if (!match) {
                    return (
                      <td
                        key={date}
                        onClick={() => setSelectedLoinc(test.loinc)}
                        style={{ width: DATE_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                      >
                        –
                      </td>
                    );
                  }
                  const hasRef = match.result.value != null && (match.result.refMin != null || match.result.refMax != null);
                  const bg = hasRef
                    ? (isOutOfRange(match.result) ? (selected ? '#e6e8f0' : '#fdecea') : (selected ? '#dbecf0' : '#e6f4ea'))
                    : (selected ? '#eaf3fb' : 'transparent');
                  // Coloring always uses the as-reported value/range (self-consistent);
                  // only the displayed number is converted for the toggle.
                  const displayValue =
                    siUsUnit && match.result.value != null
                      ? toUnit(match.result.value, marker!, match.result.unit, siUsUnit[unitSystem])
                      : match.result.value;
                  return (
                    <td
                      key={date}
                      onClick={() => setSelectedLoinc(test.loinc)}
                      style={{
                        width: DATE_COL_WIDTH,
                        padding: '8px 12px',
                        borderBottom: '1px solid #eee',
                        whiteSpace: 'nowrap',
                        background: bg,
                        cursor: 'pointer',
                      }}
                    >
                      {fmtNum(displayValue)}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    const renderIndexTable = (defs: IndexDef[]) => (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: LABEL_COL_WIDTH, textAlign: 'left', padding: '8px 12px', borderBottom: '1.5px solid #1971c2', whiteSpace: 'nowrap' }}>
                Indices
              </th>
              {visibleDates.map((date) => (
                <th
                  key={date}
                  style={{
                    width: DATE_COL_WIDTH,
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderBottom: '1.5px solid #1971c2',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatMonthYear(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {defs.map((def) => {
              const selected = selectedLoinc === def.key;
              return (
                <tr key={def.key} style={{ background: selected ? '#eaf3fb' : undefined }}>
                  <td
                    onClick={(e) => {
                      setSelectedLoinc(def.key);
                      openIndexPopup(def, e);
                    }}
                    style={{ width: LABEL_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    <span style={{ fontWeight: 600 }}>{def.nameCompact}</span>
                    {def.unit && `, ${def.unit}`}
                  </td>
                  {visibleDates.map((date) => {
                    const value = computeIndex(def, resultsByDate[date] ?? {});
                    if (value == null) {
                      return (
                        <td
                          key={date}
                          onClick={() => setSelectedLoinc(def.key)}
                          style={{ width: DATE_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >
                          –
                        </td>
                      );
                    }
                    const z = zone(value, def.cut[0], def.cut[1], def.hi);
                    const bg = selected ? SELECTED_ZONE_BG[z] : ZONE_BG[z];
                    return (
                      <td
                        key={date}
                        onClick={() => setSelectedLoinc(def.key)}
                        style={{
                          width: DATE_COL_WIDTH,
                          padding: '8px 12px',
                          borderBottom: '1px solid #eee',
                          whiteSpace: 'nowrap',
                          background: bg,
                          cursor: 'pointer',
                        }}
                      >
                        {fmtNum(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    return (
      <div style={{ padding: '56px 48px' }}>
        {navEl}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', marginBottom: 20 }}>
          <span onClick={() => navigate({ view: 'panels' })} style={{ color: '#1971c2', cursor: 'pointer' }}>
            Monitoring Panels
          </span>
          <span>›</span>
          <span onClick={() => setDetailTab('analysis')} style={{ color: '#1971c2', cursor: 'pointer' }}>
            {detailPanel}
          </span>
          <span>›</span>
          <span>{detailTab === 'analysis' ? 'Analysis' : "What's in range"}</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>{detailPanel}</h1>
        <div style={{ display: 'flex', gap: 8, borderBottom: '1.5px solid #eee', marginBottom: 24 }}>
          {(['analysis', 'in-range'] as const).map((tab) => (
            <div
              key={tab}
              onClick={() => setDetailTab(tab)}
              style={{
                padding: '10px 4px',
                marginBottom: -2,
                borderBottom: detailTab === tab ? '2px solid #1971c2' : '2px solid transparent',
                fontWeight: detailTab === tab ? 600 : 400,
                color: detailTab === tab ? '#1971c2' : '#555',
                cursor: 'pointer',
              }}
            >
              {tab === 'analysis' ? 'Analysis' : "What's in range"}
            </div>
          ))}
        </div>

        {detailTab === 'analysis' ? (
          <div>
            {controlsEl}
            {dates.length === 0 ? (
              <div style={{ color: '#888', fontSize: 14 }}>No results recorded for this panel yet.</div>
            ) : (
              <>
                {renderTable(observations, 'Observations')}
                {(indices.length > 0 || computedForPanel.length > 0) && (
                  <div style={{ marginTop: 16 }}>
                    {indices.length > 0 && renderTable(indices, 'Indices')}
                    {computedForPanel.length > 0 && renderIndexTable(computedForPanel)}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ color: '#888', fontSize: 14 }}>Coming soon.</div>
        )}
        {popupEl}
      </div>
    );
  }

  return (
    <div style={{ padding: '56px 48px' }}>
      {navEl}
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>Monitoring Panels</h1>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${PANEL_WIDTH}px)`, gap: PANEL_GAP }}>
        {conditions.map((condition) => (
          <div
            key={condition.name}
            style={{
              width: PANEL_WIDTH,
              border: '1.5px solid #1971c2',
              borderRadius: 16,
              padding: PANEL_PADDING,
              boxSizing: 'border-box',
            }}
          >
            <div
              onClick={() => openDetail(condition.name)}
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                marginBottom: 16,
                cursor: 'pointer',
              }}
            >
              {condition.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${BADGE_WIDTH}px)`, gap: BADGE_GAP }}>
              {condition.tests.filter((test) => !INDEX_LOINCS.has(test.loinc)).map((test) => {
                const style = STATUS_STYLES[getStatus(testLoincs(test))];
                return (
                <div
                  key={test.loinc}
                  onClick={(e) => openPopup(test, e)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: BADGE_WIDTH,
                    height: 40,
                    border: `1.5px solid ${style.border}`,
                    background: style.background,
                    color: style.color,
                    borderRadius: 9999,
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  {test.short}
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {popupEl}
    </div>
  );
}
