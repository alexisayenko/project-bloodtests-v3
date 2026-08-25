import { PanelIcon } from './PanelIcon';
import { PanelList } from './PanelList';
import { useLang } from '../../i18n/LangContext';
import { getPanelName, getPanelAnalyses } from '../../utils/analysis';
import type { Panel, PanelViewMode } from '../../types';

interface Props {
  panel: Panel;
  viewMode: PanelViewMode;
  index: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClick?: () => void;
}

export function PanelCard({ panel, viewMode, collapsed, onToggleCollapse, onClick }: Props) {
  const { lang, t } = useLang();
  const name = getPanelName(panel, lang);
  const count = getPanelAnalyses(panel).length;
  const style = { '--panel-color': panel.color || '#d1d5db' } as React.CSSProperties;

  if (viewMode === 'minimal') {
    return (
      <div className="panel-card" style={{ ...style, cursor: 'pointer' }} onClick={onClick}>
        <div className="panel-card-title">
          <PanelIcon panel={panel} />
          <span>{name}</span>
        </div>
        <div className="panel-card-body">
          <div className="panel-card-meta" style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
            {count} {t('analyses')}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div className="panel-card" style={style}>
        <div className="panel-card-title">
          <PanelIcon panel={panel} />
          <span>{name}</span>
        </div>
        <div className="panel-card-body">
          <ul className="panel-card-list">
            <PanelList panel={panel} viewMode={viewMode} />
          </ul>
        </div>
      </div>
    );
  }

  // Detailed mode
  return (
    <div className="panel-card" style={style}>
      <div className="panel-card-title" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
        <PanelIcon panel={panel} />
        <span>{name}</span>
        <button className={`panel-collapse-btn${collapsed ? ' collapsed' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5l4 4 4-4" />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className="panel-card-body">
          <ul className="panel-card-list">
            <PanelList panel={panel} viewMode={viewMode} />
          </ul>
        </div>
      )}
      {collapsed && (
        <div className="panel-card-collapsed">
          <div className="panel-card-meta" style={{ fontSize: '12px', color: 'var(--gray-400)', padding: '4px 0' }}>
            {count} {t('analyses')}
          </div>
        </div>
      )}
    </div>
  );
}
