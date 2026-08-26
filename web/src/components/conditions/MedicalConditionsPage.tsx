import { useMemo, useState, useEffect } from 'react';
import { useData } from '../../data/DataContext';
import { useResultsContext } from '../../data/ResultsContext';
import type { IndexDef } from '../../data/computedIndices';
import type { Result } from '../../types';
import { buildConditions, type Observation } from './markers';
import { routeToHash, hashToRoute, type Route } from './routing';
import { ReferenceBookPage } from './ReferenceBookPage';
import { POPUP_WIDTH, INDEX_POPUP_WIDTH, ANALYSIS_SETTINGS_KEY, loadAnalysisSettings, popupPosition, type SelectedCell } from './ui';
import { NavBar } from './NavBar';
import { Popup, type PopupState } from './Popup';
import { AllObservationsView } from './AllObservationsView';
import { ProfileView } from './ProfileView';
import { PanelDetailView } from './PanelDetailView';
import { PanelsGridView } from './PanelsGridView';
import type { ResultEntry } from './resultsLookup';

// The app shell: owns the route, the flattened results, the shared table
// settings and the popup, and renders one view component per section.
export function MedicalConditionsPage() {
  const { analysesCatalog, panels } = useData();
  const { sessions, loadGroupItems, loadGenerated, uploadFile, clearData, error: uploadError, sharedLinkError } = useResultsContext();
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [selectedLoinc, setSelectedLoinc] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));
  const [initialSettings] = useState(loadAnalysisSettings);
  const [unitSystem, setUnitSystem] = useState<'si' | 'us'>(initialSettings.unitSystem);
  const [sampleLimit, setSampleLimit] = useState<number | 'all'>(initialSettings.sampleLimit);
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>(initialSettings.dateOrder);
  const [allResults, setAllResults] = useState<ResultEntry[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(ANALYSIS_SETTINGS_KEY, JSON.stringify({ unitSystem, sampleLimit, dateOrder }));
    } catch {
      // storage unavailable (private browsing, quota) -- setting just won't persist
    }
  }, [unitSystem, sampleLimit, dateOrder]);

  const conditions = useMemo(() => buildConditions(panels, analysesCatalog), [panels, analysesCatalog]);

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

  useEffect(() => {
    let cancelled = false;

    async function buildAllResults() {
      const all: ResultEntry[] = [];
      for (const session of sessions) {
        const items = session.items ?? (await loadGroupItems(session.file));
        for (const item of items) {
          all.push({ loinc: item.loinc, date: session.date, place: session.place, result: item });
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
      if (result.value == null) continue; // e.g. "not tested this draw" -- don't let a blank beat a real reading
      const existing = map[loinc];
      if (!existing || date > existing.date) map[loinc] = { result, date };
    }
    return map;
  }, [allResults]);

  // Per-date lookup for computed indices: { date: { loinc: Result } }.
  const resultsByDate = useMemo(() => {
    const map: Record<string, Record<string, Result>> = {};
    for (const { loinc, date, result } of allResults) {
      map[date] ??= {};
      map[date]![loinc] = result;
    }
    return map;
  }, [allResults]);

  const openPopup = (test: Observation, e: { currentTarget: HTMLElement }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ kind: 'observation', test, ...popupPosition(rect, POPUP_WIDTH) });
  };

  const openIndexPopup = (def: IndexDef, e: { currentTarget: HTMLElement }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ kind: 'index', def, ...popupPosition(rect, INDEX_POPUP_WIDTH) });
  };

  const onSelectCell = (loinc: string, date: string) => setSelectedCell({ loinc, date });

  const openResultPopup = (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ kind: 'result', test, entry, ...popupPosition(rect, POPUP_WIDTH) });
  };

  const openIndexResultPopup = (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ kind: 'indexResult', def, date, value, ...popupPosition(rect, POPUP_WIDTH) });
  };

  const controls = { unitSystem, setUnitSystem, sampleLimit, setSampleLimit, dateOrder, setDateOrder };

  const view = (() => {
    switch (route.view) {
      case 'all':
        return (
          <AllObservationsView
            allResults={allResults}
            conditions={conditions}
            analysesCatalog={analysesCatalog}
            controls={controls}
            selectedLoinc={selectedLoinc}
            onSelect={setSelectedLoinc}
            onOpenPopup={openPopup}
            selectedCell={selectedCell}
            onSelectCell={onSelectCell}
            onOpenResultPopup={openResultPopup}
            resultsByDate={resultsByDate}
          />
        );
      case 'profile':
        return (
          <ProfileView
            sessionCount={sessions.length}
            uploadError={uploadError}
            uploadFile={uploadFile}
            loadGenerated={loadGenerated}
            clearData={clearData}
          />
        );
      case 'reference':
        return <ReferenceBookPage indexKey={route.key} navigate={navigate} />;
      case 'panel':
        return (
          <PanelDetailView
            key={route.name} // remount on panel change so the Analysis tab resets
            name={route.name}
            tests={conditions.find((c) => c.name === route.name)?.tests ?? []}
            allResults={allResults}
            resultsByDate={resultsByDate}
            controls={controls}
            selectedLoinc={selectedLoinc}
            onSelect={setSelectedLoinc}
            onOpenPopup={openPopup}
            onOpenIndexPopup={openIndexPopup}
            selectedCell={selectedCell}
            onSelectCell={onSelectCell}
            onOpenResultPopup={openResultPopup}
            onOpenIndexResultPopup={openIndexResultPopup}
            onBack={() => navigate({ view: 'panels' })}
          />
        );
      default:
        return (
          <PanelsGridView
            conditions={conditions}
            latestByLoinc={latestByLoinc}
            resultsByDate={resultsByDate}
            onOpenDetail={(name) => navigate({ view: 'panel', name })}
            onOpenPopup={openPopup}
            onOpenIndexPopup={openIndexPopup}
          />
        );
    }
  })();

  return (
    <div style={{ padding: '56px 48px' }}>
      <NavBar route={route} navigate={navigate} />
      {sharedLinkError && (
        <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>{sharedLinkError}</div>
      )}
      {view}
      <Popup
        popup={popup}
        latestByLoinc={latestByLoinc}
        resultsByDate={resultsByDate}
        onClose={() => setPopup(null)}
        onLearnMore={(key) => navigate({ view: 'reference', key })}
      />
    </div>
  );
}
