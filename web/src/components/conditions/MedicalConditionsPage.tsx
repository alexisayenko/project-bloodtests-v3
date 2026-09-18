import { useMemo, useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useData } from '../../data/DataContext';
import { useResultsContext } from '../../data/ResultsContext';
import { validateDiagnosticReports, hasErrors } from '../../data/validateDiagnosticReports';
import type { IndexDef } from '../../data/computedIndices';
import type { Result } from '../../types';
import { buildConditions, type Observation } from './markers';
import { routeToHash, hashToRoute, allObservationsRoute, isRouteBlocked, DEFAULT_OBSERVATIONS_TAB, type Route } from './routing';
import { POPUP_WIDTH, INDEX_POPUP_WIDTH, loadViewSettings, saveViewSettings, hasStoredViewSettings, seedViewSettings, popupPosition, type SelectedCell } from './ui';
import { panelAllowlist, isPanelVisible, visiblePanels } from '../../data/sharedMeta';
import { AppShell } from './AppShell';
import { Popup, type PopupPosition, type PopupState } from './Popup';
import { PanelsGridView } from './PanelsGridView';
import { EmptyState } from '../primitives';
import { useScheduled, sortVisitsByMonth, type IndexScheduling, type RowScheduling } from './scheduled';
import { useMedications } from '../../data/medications';
import { clearAllData, restoreBackup, type BackupContents } from '../../data/backupRestore';
import { latestEntryByLoinc, type ResultEntry } from './resultsLookup';
import { COLOR } from '../../styles/tokens';

// PanelsGridView is the entry route and stays a static import; every other section is lazy so the first paint never waits on it.
const ReferenceBookPage = lazy(() => import('./ReferenceBookPage').then((m) => ({ default: m.ReferenceBookPage })));
const AllObservationsView = lazy(() => import('./AllObservationsView').then((m) => ({ default: m.AllObservationsView })));
const ProfileView = lazy(() => import('./ProfileView').then((m) => ({ default: m.ProfileView })));
const MedicationsView = lazy(() => import('./MedicationsView').then((m) => ({ default: m.MedicationsView })));
const HormonalPathwaysView = lazy(() => import('./HormonalPathwaysView').then((m) => ({ default: m.HormonalPathwaysView })));
const LipidTransportView = lazy(() => import('./LipidTransportView').then((m) => ({ default: m.LipidTransportView })));
const AccountView = lazy(() => import('./AccountView').then((m) => ({ default: m.AccountView })));
const PlanVisitView = lazy(() => import('./PlanVisitView').then((m) => ({ default: m.PlanVisitView })));
const PanelDetailView = lazy(() => import('./PanelDetailView').then((m) => ({ default: m.PanelDetailView })));
const DiagnosticReportsView = lazy(() => import('./DiagnosticReportsView').then((m) => ({ default: m.DiagnosticReportsView })));
const DiagnosticReportDetailView = lazy(() =>
  import('./DiagnosticReportDetailView').then((m) => ({ default: m.DiagnosticReportDetailView }))
);

const routeFallback = <EmptyState style={{ minHeight: 400 }}>Loading…</EmptyState>;

/** A popup's own content, before the opener anchors it to the clicked element. */
type PopupPayload = {
  [K in PopupState['kind']]: Omit<Extract<PopupState, { kind: K }>, keyof PopupPosition>;
}[PopupState['kind']];

const REPORTS_ROUTE: Route = { view: 'reports' };

// In memory, not storage: a full reload is a fresh visit and should start at the top.
let savedPanelsScrollY: number | null = null;

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
  const [compactPanels, setCompactPanels] = useState(initialSettings.compactPanels);
  const [allResults, setAllResults] = useState<ResultEntry[]>([]);
  // One scheduling state for the whole shell, since Panel Detail remounts per panel.
  const {
    scheduledVisits,
    onToggleRow,
    onToggleIndex,
    onSetMonth,
    onSelectLab,
    onAddVisit,
    onRemoveVisit,
    onReload: reloadScheduled,
  } = useScheduled();
  const { medications } = useMedications();
  // Sorted once for every consumer, so `#plan` tabs and Scheduled columns never disagree on visit order.
  const sortedVisits = useMemo(() => sortVisitsByMonth(scheduledVisits.visits), [scheduledVisits.visits]);

  useEffect(() => {
    saveViewSettings({ unitSystem, sampleLimit, compactPanels });
  }, [unitSystem, sampleLimit, compactPanels]);

  // Share-link settings seed only a visitor with none stored; adjusted during render so the first paint uses the seed.
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

  // Redirected during render so the blocked view never paints; the URL is replaced, not pushed, so Back cannot loop.
  const [redirectCount, setRedirectCount] = useState(0);
  if (isRouteBlocked(route, hasValidationErrors)) {
    setRoute(REPORTS_ROUTE);
    setPopup(null);
    setRedirectCount((n) => n + 1);
  }
  useEffect(() => {
    if (redirectCount > 0) window.history.replaceState(null, '', routeToHash(REPORTS_ROUTE));
  }, [redirectCount]);

  useEffect(() => {
    // The URL is the single source of truth for the route; a popup never survives navigation.
    const onPopState = () => {
      setPopup(null);
      setRoute(hashToRoute(window.location.hash));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: Route) => {
    if (route.view === 'panels' && next.view === 'panel') savedPanelsScrollY = window.scrollY;
    window.history.pushState(null, '', routeToHash(next));
    setPopup(null);
    setRoute(next);
  };

  // Keyed off the route itself so chevron and browser Back restore alike; deferred a frame so the grid has laid out.
  const prevRouteRef = useRef(route);
  useEffect(() => {
    const prev = prevRouteRef.current;
    prevRouteRef.current = route;
    if (prev.view === 'panel' && route.view === 'panels' && savedPanelsScrollY != null) {
      const y = savedPanelsScrollY;
      savedPanelsScrollY = null;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, [route]);

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

  const latestByLoinc = useMemo(() => latestEntryByLoinc(allResults, { numericOnly: true }), [allResults]);

  const resultsByDate = useMemo(() => {
    const map: Record<string, Record<string, Result>> = {};
    for (const { loinc, date, result } of allResults) {
      map[date] ??= {};
      map[date]![loinc] = result;
    }
    return map;
  }, [allResults]);

  const openPopupFrom = (payload: PopupPayload, e: { currentTarget: HTMLElement }) => {
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

  // A clear or restore rewrites storage underneath this state, so it has to be read back.
  const reloadStoredState = () => {
    reloadScheduled();
    const stored = loadViewSettings();
    setUnitSystem(stored.unitSystem);
    setSampleLimit(stored.sampleLimit);
    setCompactPanels(stored.compactPanels);
  };

  const onClearAll = () => {
    clearAllData(clearData);
    reloadStoredState();
  };

  const onImportAll = async (backup: BackupContents) => {
    const lines = await restoreBackup(backup, {
      clearReports: clearData,
      importReports: (text) => uploadFile(new File([text], 'lab-reports.json', { type: 'application/json' })),
    });
    reloadStoredState();
    return lines;
  };

  const controls = { unitSystem, setUnitSystem, sampleLimit, setSampleLimit };
  const rowSchedulings: RowScheduling[] = sortedVisits.map((visit) => ({
    scheduled: visit,
    onToggle: (loincs: string[]) => onToggleRow(visit.id, loincs),
    onSetMonth: (month: string | undefined) => onSetMonth(visit.id, month),
    onRemove: () => onRemoveVisit(visit.id),
  }));
  const indexSchedulings: IndexScheduling[] = sortedVisits.map((visit) => ({
    scheduled: visit,
    onToggle: (key: string) => onToggleIndex(visit.id, key),
    onSetMonth: (month: string | undefined) => onSetMonth(visit.id, month),
    onRemove: () => onRemoveVisit(visit.id),
  }));

  const panelsGrid = (
    <PanelsGridView
      conditions={shownConditions}
      latestByLoinc={latestByLoinc}
      resultsByDate={resultsByDate}
      compact={compactPanels}
      onCompactChange={setCompactPanels}
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
            scheduling={rowSchedulings}
            indexScheduling={indexSchedulings}
            onAddVisit={onAddVisit}
            tab={route.tab ?? DEFAULT_OBSERVATIONS_TAB}
            onTabChange={(tab) => navigate(allObservationsRoute(tab))}
            medications={medications.rows}
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
            onStoredStateChanged={reloadStoredState}
            onGenerated={() => navigate({ view: 'all', tab: 'in-range' })}
          />
        );
      case 'pathways':
        return (
          <HormonalPathwaysView
            allResults={allResults}
            resultsByDate={resultsByDate}
            panelTests={conditions.find((c) => c.name === 'Hypogonadism')?.tests ?? []}
            unitSystem={unitSystem}
            onUnitSystemChange={setUnitSystem}
          />
        );
      case 'lipids':
        return (
          <LipidTransportView
            allResults={allResults}
            resultsByDate={resultsByDate}
            panelTests={conditions.find((c) => c.name === 'Cardiovascular Risk')?.tests ?? []}
            unitSystem={unitSystem}
            onUnitSystemChange={setUnitSystem}
          />
        );
      case 'medications':
        return <MedicationsView />;
      case 'account':
        return <AccountView sessions={sessions} onClearAll={onClearAll} onImportAll={onImportAll} />;
      case 'plan':
        return <PlanVisitView visits={sortedVisits} onOpenPopup={openPopup} onSelectLab={onSelectLab} onSetMonth={onSetMonth} />;
      case 'reference':
        return (
          <ReferenceBookPage indexKey={route.key} navigate={navigate} allResults={allResults} onOpenPopup={openPopup} />
        );
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
            scheduling={rowSchedulings}
            indexScheduling={indexSchedulings}
            onAddVisit={onAddVisit}
            onBack={() => navigate({ view: 'panels' })}
            medications={medications.rows}
          />
        );
      default:
        return panelsGrid;
    }
  })();

  return (
    <AppShell route={route} navigate={navigate} hasValidationErrors={hasValidationErrors}>
      {sharedLinkError && (
        <div style={{ color: COLOR.textMuted, fontSize: 13, marginBottom: 12 }}>{sharedLinkError}</div>
      )}
      {hasValidationErrors && (route.view === 'reports' || route.view === 'report') && (
        <div style={{ fontSize: 13, color: COLOR.statusBadText, marginBottom: 16 }}>
          Errors in diagnostic reports must be resolved before accessing other sections.
        </div>
      )}
      <Suspense fallback={routeFallback}>{view}</Suspense>
      <Popup
        popup={popup}
        latestByLoinc={latestByLoinc}
        resultsByDate={resultsByDate}
        onClose={() => setPopup(null)}
        onLearnMore={(key) => navigate({ view: 'reference', key })}
      />
    </AppShell>
  );
}
