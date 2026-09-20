import { useMemo, lazy, Suspense } from 'react';
import { useData } from '../../data/DataContext';
import { useResultsContext } from '../../data/ResultsContext';
import { validateDiagnosticReports, hasErrors } from '../../data/validateDiagnosticReports';
import { buildConditions } from './markers';
import { ALL_OBSERVATIONS_PANEL, DEFAULT_PANEL_TAB, panelRoute } from './routing';
import { panelAllowlist, isPanelVisible, visiblePanels } from '../../data/sharedMeta';
import { AppShell } from './AppShell';
import { Popup } from './Popup';
import { PopupProvider, usePopupState } from './PopupContext';
import { SchedulingProvider, useSchedulingState } from './SchedulingContext';
import { PanelsGridView } from './PanelsGridView';
import { EmptyState } from '../primitives';
import { useHashRoute } from '../../hooks/useHashRoute';
import { useViewSettings } from '../../hooks/useViewSettings';
import { useAllResults } from '../../hooks/useAllResults';
import { useMedications } from '../../hooks/useMedications';
import { clearAllData, restoreBackup, type BackupContents } from '../../data/backupRestore';
import { COLOR } from '../../styles/tokens';

// PanelsGridView is the entry route and stays a static import; every other section is lazy so the first paint never waits on it.
const ReferenceBookPage = lazy(() => import('./ReferenceBookPage').then((m) => ({ default: m.ReferenceBookPage })));
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

export function MedicalConditionsPage() {
  const { analysesCatalog, panels, monitoringPanels } = useData();
  const { sessions, loadGroupItems, loadGenerated, addUpload, restoreReportFiles, uploadFile, updateGroup, clearData, error: uploadError, sharedLinkError, sharedMeta } = useResultsContext();

  const validationIssues = useMemo(() => validateDiagnosticReports(sessions), [sessions]);
  const hasValidationErrors = hasErrors(validationIssues);

  const { route, navigate } = useHashRoute(hasValidationErrors);
  const popup = usePopupState(route);
  const { scheduling, reload: reloadScheduled } = useSchedulingState();
  const settings = useViewSettings(sharedMeta);
  const { unitSystem, setUnitSystem, sampleLimit, setSampleLimit, compactPanels, setCompactPanels } = settings;
  const { allResults, latestByLoinc, resultsByDate } = useAllResults(sessions, loadGroupItems);
  const { medications } = useMedications();

  const conditions = useMemo(
    () => buildConditions(panels, analysesCatalog, monitoringPanels),
    [panels, analysesCatalog, monitoringPanels]
  );
  const allowedPanels = panelAllowlist(sharedMeta);
  const shownConditions = useMemo(() => visiblePanels(conditions, allowedPanels), [conditions, allowedPanels]);

  // A clear or restore rewrites storage underneath this state, so it has to be read back.
  const reloadStoredState = () => {
    reloadScheduled();
    settings.reload();
  };

  const onClearAll = () => {
    clearAllData(clearData);
    reloadStoredState();
  };

  const onImportAll = async (backup: BackupContents) => {
    const lines = await restoreBackup(backup, {
      clearReports: clearData,
      importReports: restoreReportFiles,
    });
    reloadStoredState();
    return lines;
  };

  const controls = { unitSystem, setUnitSystem, sampleLimit, setSampleLimit };

  const panelsGrid = (
    <PanelsGridView
      conditions={shownConditions}
      latestByLoinc={latestByLoinc}
      resultsByDate={resultsByDate}
      compact={compactPanels}
      onCompactChange={setCompactPanels}
      onOpenDetail={(name) => navigate({ view: 'panel', name })}
      onOpenPopup={popup.openPopup}
      onOpenIndexPopup={popup.openIndexPopup}
    />
  );

  const diagnosticReportsList = (
    <DiagnosticReportsView
      sessions={sessions}
      onOpenDetail={(file) => navigate({ view: 'report', file })}
      onAddReports={addUpload}
      onClear={clearData}
    />
  );

  const view = (() => {
    // A hash pointing at a panel the link doesn't share falls back to the grid; the All Observations
    // pseudo-panel is never blocked by the allowlist.
    if (
      route.view === 'panel' &&
      route.name !== ALL_OBSERVATIONS_PANEL &&
      conditions.length > 0 &&
      !isPanelVisible(route.name, allowedPanels)
    ) {
      return panelsGrid;
    }
    // A hash pointing at a report that isn't loaded (stale link, cleared data) falls back to the list.
    if (route.view === 'report' && sessions.length > 0 && !sessions.some((s) => s.file === route.file)) {
      return diagnosticReportsList;
    }
    switch (route.view) {
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
            onGenerated={() => navigate({ view: 'panel', name: ALL_OBSERVATIONS_PANEL, tab: 'trends' })}
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
        return <PlanVisitView />;
      case 'reference':
        return (
          <ReferenceBookPage indexKey={route.key} navigate={navigate} allResults={allResults} onOpenPopup={popup.openPopup} />
        );
      case 'panel':
        return (
          <PanelDetailView
            key={route.name} // remount on panel change so the Analysis tab resets
            name={route.name}
            tests={conditions.find((c) => c.name === route.name)?.tests ?? []}
            conditions={conditions}
            panelOptions={shownConditions}
            analysesCatalog={analysesCatalog}
            allResults={allResults}
            resultsByDate={resultsByDate}
            controls={controls}
            tab={route.tab ?? DEFAULT_PANEL_TAB}
            onTabChange={(tab) => navigate(panelRoute(route.name, tab))}
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
      <PopupProvider value={popup}>
        <SchedulingProvider value={scheduling}>
          <Suspense fallback={routeFallback}>{view}</Suspense>
          <Popup latestByLoinc={latestByLoinc} resultsByDate={resultsByDate} onLearnMore={(key) => navigate({ view: 'reference', key })} />
        </SchedulingProvider>
      </PopupProvider>
    </AppShell>
  );
}
