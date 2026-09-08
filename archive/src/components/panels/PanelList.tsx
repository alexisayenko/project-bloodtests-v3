import { useLang } from '../../i18n/LangContext';
import { useData } from '../../data/DataContext';
import { AnalysisItem } from './AnalysisItem';
import type { Panel, PanelViewMode } from '../../types';

interface Props {
  panel: Panel;
  viewMode: PanelViewMode;
}

export function PanelList({ panel, viewMode }: Props) {
  const { lang } = useLang();
  const { analysesCatalog } = useData();

  if (panel.sections) {
    return (
      <>
        {panel.sections.map((section, si) => {
          const sectionName = (lang !== 'en' && section.lang[lang]) ? section.lang[lang] : section.name;
          const items = section.loincs.map(l => analysesCatalog[l]).filter(Boolean);
          return (
            <li key={si} style={{ listStyle: 'none' }}>
              {viewMode !== 'minimal' && (
                <div className="panel-card-section">{sectionName}</div>
              )}
              <ul className="panel-card-list">
                {items.map(a => (
                  <AnalysisItem key={a.loinc} analysis={a} viewMode={viewMode} />
                ))}
              </ul>
            </li>
          );
        })}
      </>
    );
  }

  const items = (panel.loincs || []).map(l => analysesCatalog[l]).filter(Boolean);
  return (
    <>
      {items.map(a => (
        <AnalysisItem key={a.loinc} analysis={a} viewMode={viewMode} />
      ))}
    </>
  );
}
