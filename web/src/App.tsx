import { useState } from 'react';
import { LangProvider } from './i18n/LangContext';
import { DataProvider } from './data/DataContext';
import { ResultsProvider, useResultsContext } from './data/ResultsContext';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { UploadPage } from './components/upload/UploadPage';
import { PanelsPage } from './components/panels/PanelsPage';
import { PanelDetailPage } from './components/panels/PanelDetailPage';
import { ResultsPage } from './components/results/ResultsPage';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import type { ViewName } from './types';

function AppShell() {
  const { sessions, hasData, loading, loadGroupItems } = useResultsContext();
  const [view, setView] = useState<ViewName>('panels');
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null);

  if (!loading && !hasData) {
    return (
      <div className="app">
        <Header />
        <main className="main">
          <UploadPage />
        </main>
      </div>
    );
  }

  const showDetail = (panelIndex: number) => {
    setSelectedPanel(panelIndex);
    setView('panel-detail');
  };

  return (
    <div className="app">
      <Header />
      <main className="main">
        {view === 'panels' && <PanelsPage onShowDetail={showDetail} />}
        {view === 'panel-detail' && selectedPanel != null && (
          <PanelDetailPage panelIndex={selectedPanel} onBack={() => setView('panels')} />
        )}
        {view === 'results' && (
          <ResultsPage sessions={sessions} loading={loading} loadGroupItems={loadGroupItems} />
        )}
        {view === 'analytics' && <AnalyticsPage />}
      </main>
      <BottomNav activeView={view} onNavigate={setView} />
    </div>
  );
}

function App() {
  return (
    <LangProvider>
      <DataProvider>
        <ResultsProvider>
          <AppShell />
        </ResultsProvider>
      </DataProvider>
    </LangProvider>
  );
}

export default App;
