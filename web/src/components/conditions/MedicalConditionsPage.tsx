import { useMemo, useState, useEffect } from 'react';
import { useData } from '../../data/DataContext';
import { useResultsContext } from '../../data/ResultsContext';
import { validateDiagnosticReports, hasErrors } from '../../data/validateDiagnosticReports';
import type { IndexDef } from '../../data/computedIndices';
import type { Result } from '../../types';
import { buildConditions, type Observation } from './markers';
import { routeToHash, hashToRoute, type Route } from './routing';
import { ReferenceBookPage } from './ReferenceBookPage';
import { POPUP_WIDTH, INDEX_POPUP_WIDTH, loadViewSettings, saveViewSettings, hasStoredViewSettings, seedViewSettings, popupPosition, type SelectedCell } from './ui';
import { panelAllowlist, isPanelVisible, visiblePanels } from '../../data/sharedMeta';
import { NavBar } from './NavBar';
import { Popup, type PopupPosition, type PopupState } from './Popup';
import { AllObservationsView } from './AllObservationsView';
import { ProfileView } from './ProfileView';
import { MedicationsView } from './MedicationsView';
import { PlanVisitView } from './PlanVisitView';
import { PanelDetailView } from './PanelDetailView';
import { PanelsGridView } from './PanelsGridView';
import { DiagnosticReportsView } from './DiagnosticReportsView';
import { DiagnosticReportDetailView } from './DiagnosticReportDetailView';
import { ScheduleLabContext, useScheduled } from './scheduled';
import type { ResultEntry } from './resultsLookup';
import { COLOR } from '../../styles/tokens';

/** A popup's own content, before the opener anchors it to the clicked element. */
type PopupPayload = {
  [K in PopupState['kind']]: Omit<Extract<PopupState, { kind: K }>, keyof PopupPosition>;
}[PopupState['kind']];

// The app shell: owns the route, the flattened results, the shared table
// settings and the popup, and renders one view component per section.
export function MedicalConditionsPage() {
  const { analysesCatalog, panels, monitoringPanels } = useData();
  const { sessions, loadGroupItems, loadGenerated, uploadFile, updateGroup, clearData, error: uploadError, sharedLinkError, sharedMeta } = useResultsContext();
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [selectedLoinc, setSelectedLoinc] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));
  const [initialSettings] = useState(loadViewSettings);
  const [hadStoredSettings] = useState(hasStoredViewSettings);
  const [unitSystem, setUnitSystem] = useState<'si' | 'us'>(initialSettings.unitSystem);
  const [sampleLimit, setSampleLimit] = useState<number | 'all'>(initialSettings.sampleLimit);
  const [allResults, setAllResults] = useState<ResultEntry[]>([]);
  // One scheduling state for the whole shell: a row toggled in All Observations
  // is the same row in Panel Detail, so both views read and write this.
  const { scheduled, onToggleRow, onToggleIndex, onToggleAllRows, onToggleAllIndices, onSetMonth, onSetLab } = useScheduled();
  const scheduleLab = useMemo(() => ({ scheduled, onSetLab }), [scheduled, onSetLab]);

  useEffect(() => {
    saveViewSettings({ unitSystem, sampleLimit });
  }, [unitSystem, sampleLimit]);

  // A share link's settings seed the controls only for a visitor who has none
  // of their own stored yet; once they pick anything, that choice is theirs.
  // Adjusted during render (React's prop-change pattern) rather than in an
  // effect, so the first paint after the meta arrives already uses the seed.
  const [seededFrom, setSeededFrom] = useState<typeof sharedMeta>(null);
  if (!hadStoredSettings && sharedMeta?.settings && sharedMeta !== seededFrom) {
    const seeded = seedViewSettings(sharedMeta.settings);
    setSeededFrom(sharedMeta);
    setUnitSystem(seeded.unitSystem);
    setSampleLimit(seeded.sampleLimit);
  }

  const conditions = useMemo(
    () => buildConditions(panels, analysesCatalog, monitoringPanels),
    [panels, analysesCatalog, monitoringPanels]
  );
  const allowedPanels = panelAllowlist(sharedMeta);
  const shownConditions = useMemo(() => visiblePanels(conditions, allowedPanels), [conditions, allowedPanels]);

  const validationIssues = useMemo(() => validateDiagnosticReports(sessions), [sessions]);
  const hasValidationErrors = hasErrors(validationIssues);

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

  const openPopupFrom = (payload: PopupPayload, e: { currentTarget: HTMLElement }) => {
    // 'result' and 'indexResult' are both simple value cards (name + date + one
    // colored value line) -- same narrow width as 'observation'.
    const width = payload.kind === 'index' ? INDEX_POPUP_WIDTH : POPUP_WIDTH;
    setPopup({ ...payload, ...popupPosition(e.currentTarget.getBoundingClientRect(), width) });
  };

  const openPopup = (test: Observation, e: { currentTarget: HTMLElement }) => openPopupFrom({ kind: 'observation', test }, e);

  const openIndexPopup = (def: IndexDef, e: { currentTarget: HTMLElement }) => openPopupFrom({ kind: 'index', def }, e);

  const openResultPopup = (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) =>
    openPopupFrom({ kind: 'result', test, entry }, e);

  const openIndexResultPopup = (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) =>
    openPopupFrom({ kind: 'indexResult', def, date, value }, e);

  const onSelectCell = (loinc: string, date: string) => setSelectedCell({ loinc, date });

  const controls = { unitSystem, setUnitSystem, sampleLimit, setSampleLimit };
  const rowScheduling = { scheduled, onToggle: onToggleRow, onToggleAll: onToggleAllRows, onSetMonth };
  const indexScheduling = { scheduled, onToggle: onToggleIndex, onToggleAll: onToggleAllIndices, onSetMonth };

  const panelsGrid = (
    <PanelsGridView
      conditions={shownConditions}
      latestByLoinc={latestByLoinc}
      resultsByDate={resultsByDate}
      onOpenDetail={(name) => navigate({ view: 'panel', name })}
      onOpenPopup={openPopup}
      onOpenIndexPopup={openIndexPopup}
    />
  );

  const diagnosticReportsList = (
    <DiagnosticReportsView
      sessions={sessions}
      onOpenDetail={(file) => navigate({ view: 'report', file })}
      onAddReports={loadGenerated}
      onImportFile={uploadFile}
      importError={uploadError}
      onClear={clearData}
    />
  );

  const view = (() => {
    // A hash pointing at a panel the link doesn't share falls back to the grid.
    if (route.view === 'panel' && conditions.length > 0 && !isPanelVisible(route.name, allowedPanels)) {
      return panelsGrid;
    }
    // A hash pointing at a report that isn't loaded (stale link, cleared data) falls back to the list.
    if (route.view === 'report' && sessions.length > 0 && !sessions.some((s) => s.file === route.file)) {
      return diagnosticReportsList;
    }
    switch (route.view) {
      case 'all':
        return (
          <AllObservationsView
            allResults={allResults}
            conditions={conditions}
            panelOptions={shownConditions}
            analysesCatalog={analysesCatalog}
            controls={controls}
            selectedLoinc={selectedLoinc}
            onSelect={setSelectedLoinc}
            onOpenPopup={openPopup}
            onOpenIndexPopup={openIndexPopup}
            selectedCell={selectedCell}
            onSelectCell={onSelectCell}
            onOpenResultPopup={openResultPopup}
            onOpenIndexResultPopup={openIndexResultPopup}
            resultsByDate={resultsByDate}
            scheduling={rowScheduling}
            indexScheduling={indexScheduling}
          />
        );
      case 'reports':
        return diagnosticReportsList;
      case 'report':
        return (
          <DiagnosticReportDetailView
            key={route.file}
            group={sessions.find((s) => s.file === route.file)}
            loadGroupItems={loadGroupItems}
            onBack={() => navigate({ view: 'reports' })}
            onUpdateGroup={updateGroup}
          />
        );
      case 'profile':
        return (
          <ProfileView
            sessionCount={sessions.length}
            uploadError={uploadError}
            uploadFile={uploadFile}
            loadGenerated={loadGenerated}
          />
        );
      case 'medications':
        return <MedicationsView />;
      case 'plan':
        return <PlanVisitView scheduled={scheduled} />;
      case 'reference':
        return <ReferenceBookPage indexKey={route.key} navigate={navigate} allResults={allResults} />;
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
            scheduling={rowScheduling}
            indexScheduling={indexScheduling}
            onBack={() => navigate({ view: 'panels' })}
          />
        );
      default:
        return panelsGrid;
    }
  })();

  const blockedRoutes = hasValidationErrors && (route.view === 'panels' || route.view === 'panel' || route.view === 'all');
  if (blockedRoutes) {
    navigate({ view: 'reports' });
  }

  return (
    <div className="mc-page">
      <NavBar route={route} navigate={navigate} hasValidationErrors={hasValidationErrors} />
      {sharedLinkError && (
        <div style={{ color: COLOR.textMuted, fontSize: 13, marginBottom: 12 }}>{sharedLinkError}</div>
      )}
      {hasValidationErrors && (route.view === 'reports' || route.view === 'report') && (
        <div style={{ fontSize: 13, color: COLOR.statusBad, marginBottom: 16 }}>
          Errors in diagnostic reports must be resolved before accessing other sections.
        </div>
      )}
      <ScheduleLabContext.Provider value={scheduleLab}>{view}</ScheduleLabContext.Provider>
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
