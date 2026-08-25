import { useState, useEffect, useMemo } from 'react';
import { useLang } from '../../i18n/LangContext';
import { useData } from '../../data/DataContext';
import { formatDate } from '../../utils/format';
import { getPanelName, getPanelAnalyses } from '../../utils/analysis';
import { ResultRow } from './ResultRow';
import type { ResultGroup, Result } from '../../types';

interface Props {
  group: ResultGroup;
  loadItems: (sessionId: string) => Promise<Result[]>;
  onBack: () => void;
}

interface PanelGroup {
  panelName: string;
  color: string;
  results: Result[];
}

export function ResultDetailPage({ group, loadItems, onBack }: Props) {
  const { t, lang } = useLang();
  const { panels } = useData();
  const [items, setItems] = useState<Result[] | null>(group.items);

  useEffect(() => {
    if (!items && group.file) {
      loadItems(group.file).then(setItems);
    }
  }, [group.file, items, loadItems]);

  // Build loinc -> panel lookup and group results by panel
  const groupedByPanel = useMemo(() => {
    if (!items || panels.length === 0) return null;

    const loincToPanel: Record<string, number> = {};
    panels.forEach((p, pi) => {
      getPanelAnalyses(p).forEach(loinc => {
        loincToPanel[loinc] = pi;
      });
    });

    const panelGroups: Record<number, PanelGroup> = {};
    const ungrouped: Result[] = [];

    for (const r of items) {
      const pi = loincToPanel[r.loinc];
      if (pi !== undefined) {
        if (!panelGroups[pi]) {
          panelGroups[pi] = {
            panelName: getPanelName(panels[pi], lang),
            color: panels[pi].color || '#d1d5db',
            results: [],
          };
        }
        panelGroups[pi].results.push(r);
      } else {
        ungrouped.push(r);
      }
    }

    // Sort panel groups by panel order
    const sorted = Object.keys(panelGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .map(pi => panelGroups[pi]);

    if (ungrouped.length > 0) {
      sorted.push({ panelName: 'Other', color: '#d1d5db', results: ungrouped });
    }

    return sorted;
  }, [items, panels, lang]);

  if (!items) return <div className="loading">Loading...</div>;

  return (
    <div>
      <button className="btn-back" onClick={onBack}>{t('back')}</button>
      <div className="detail-header">
        <h2>{group.place || 'Blood Test'}</h2>
        <div className="detail-date">{formatDate(group.date, lang)}</div>
      </div>

      {groupedByPanel && (
        <div className="results-table" style={{ marginTop: '20px' }}>
          <div className="results-header">
            <span>{t('biomarker')}</span>
            <span>{t('value')}</span>
            <span>{t('reference')}</span>
          </div>
          {groupedByPanel.map((pg, gi) => (
            <div key={gi}>
              <div className="result-panel-divider" style={{ '--row-panel-color': pg.color } as React.CSSProperties}>
                {pg.panelName}
              </div>
              {pg.results.map((r, i) => (
                <ResultRow key={`${gi}-${i}`} result={r} panelColor={pg.color} />
              ))}
            </div>
          ))}
        </div>
      )}

      {!groupedByPanel && (
        <div className="results-table">
          <div className="results-header">
            <span>{t('biomarker')}</span>
            <span>{t('value')}</span>
            <span>{t('reference')}</span>
          </div>
          {items.map((r, i) => (
            <ResultRow key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}
