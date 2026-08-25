import { useCallback } from 'react';
import { useData } from '../../data/DataContext';
import { useLang } from '../../i18n/LangContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { getPanelAnalyses } from '../../utils/analysis';
import { PanelCard } from './PanelCard';
import type { PanelViewMode } from '../../types';

interface Props {
  onShowDetail: (panelIndex: number) => void;
}

export function PanelsPage({ onShowDetail }: Props) {
  const { panels, loading } = useData();
  const { t } = useLang();
  const [viewMode, setViewMode] = useLocalStorage<PanelViewMode>('bloodtests_panelView', 'detailed');
  const [collapsedPanels, setCollapsedPanels] = useLocalStorage<Record<string, boolean>>('bloodtests_collapsed', {});

  const togglePanel = useCallback((panelId: string) => {
    const next = { ...collapsedPanels };
    if (next[panelId]) { delete next[panelId]; } else { next[panelId] = true; }
    setCollapsedPanels(next);
  }, [collapsedPanels, setCollapsedPanels]);

  const toggleAll = useCallback(() => {
    const allCollapsed = panels.every(p => collapsedPanels[p.id]);
    if (allCollapsed) {
      setCollapsedPanels({});
    } else {
      const all: Record<string, boolean> = {};
      panels.forEach(p => { all[p.id] = true; });
      setCollapsedPanels(all);
    }
  }, [panels, collapsedPanels, setCollapsedPanels]);

  if (loading) return <div className="loading">Loading...</div>;
  if (panels.length === 0) return <div className="empty-state">{t('noPanels')}</div>;

  const totalAnalyses = panels.reduce((sum, p) => sum + getPanelAnalyses(p).length, 0);
  const gridClass = viewMode === 'minimal' ? 'panels-grid' : 'panels-grid panels-grid-single';

  return (
    <div>
      <div className="view-toggle">
        {(['minimal', 'compact', 'detailed'] as PanelViewMode[]).map(mode => (
          <button
            key={mode}
            className={`view-toggle-btn${viewMode === mode ? ' active' : ''}`}
            onClick={() => setViewMode(mode)}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
        {viewMode === 'detailed' && (
          <button className="view-toggle-btn utility" onClick={toggleAll}>
            Collapse / Expand all
          </button>
        )}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '8px' }}>
        {panels.length} {t('panels')} · {totalAnalyses} {t('analyses')}
      </div>
      <div className={gridClass}>
        {panels.map((p, i) => (
          <PanelCard
            key={p.id}
            panel={p}
            viewMode={viewMode}
            index={i}
            collapsed={viewMode === 'detailed' ? !!collapsedPanels[p.id] : false}
            onToggleCollapse={() => togglePanel(p.id)}
            onClick={viewMode === 'minimal' ? () => onShowDetail(i) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
