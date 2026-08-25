import { useData } from '../../data/DataContext';
import { useLang } from '../../i18n/LangContext';
import { getPanelName } from '../../utils/analysis';
import { PanelIcon } from './PanelIcon';
import { PanelList } from './PanelList';

interface Props {
  panelIndex: number;
  onBack: () => void;
}

export function PanelDetailPage({ panelIndex, onBack }: Props) {
  const { panels } = useData();
  const { lang, t } = useLang();
  const panel = panels[panelIndex];

  if (!panel) return null;

  const style = { '--panel-color': panel.color || '#d1d5db' } as React.CSSProperties;

  return (
    <div>
      <button className="btn-back" onClick={onBack}>{t('back')}</button>
      <div className="panel-card" style={style}>
        <div className="panel-card-title">
          <PanelIcon panel={panel} />
          <span>{getPanelName(panel, lang)}</span>
        </div>
        <div className="panel-card-body">
          <ul className="panel-card-list">
            <PanelList panel={panel} viewMode="detailed" />
          </ul>
        </div>
      </div>
    </div>
  );
}
