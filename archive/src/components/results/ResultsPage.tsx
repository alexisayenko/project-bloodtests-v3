import { useState, useMemo, useCallback } from 'react';
import { useLang } from '../../i18n/LangContext';
import { useData } from '../../data/DataContext';
import { formatDate, isOutOfRange, isNearOutOfRange } from '../../utils/format';
import { getPanelName, getPanelAnalyses } from '../../utils/analysis';
import { ResultRow } from './ResultRow';
import type { DiagnosticReport, Result } from '../../types';

type ResultsView = 'sessions' | 'out-of-range' | 'near-range';

interface PanelGroup {
  panelName: string;
  color: string;
  results: Result[];
}

interface Props {
  sessions: DiagnosticReport[];
  loading: boolean;
  loadGroupItems: (sessionId: string) => Promise<Result[]>;
}

export function ResultsPage({ sessions, loading, loadGroupItems }: Props) {
  const { t } = useLang();
  const { panels } = useData();
  const { lang: uiLang } = useLang();
  const [view, setView] = useState<ResultsView>('sessions');
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [loadedItems, setLoadedItems] = useState<Record<string, Result[]>>({});

  // Filter function based on current view
  const filterResults = useCallback((items: Result[]): Result[] => {
    if (view === 'sessions') return items;
    if (view === 'out-of-range') return items.filter(r => isOutOfRange(r));
    if (view === 'near-range') return items.filter(r => isOutOfRange(r) || isNearOutOfRange(r));
    return items;
  }, [view]);

  const toggleSession = useCallback(async (sessionId: string, items: Result[] | null) => {
    if (expandedSessions[sessionId]) {
      setExpandedSessions(prev => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      return;
    }

    if (!items && !loadedItems[sessionId]) {
      const loaded = await loadGroupItems(sessionId);
      setLoadedItems(prev => ({ ...prev, [sessionId]: loaded }));
    }

    setExpandedSessions(prev => ({ ...prev, [sessionId]: true }));
  }, [expandedSessions, loadedItems, loadGroupItems]);

  const toggleAllSessions = useCallback(() => {
    const visibleSessions = getVisibleSessions();
    const allExpanded = visibleSessions.length > 0 && visibleSessions.every(g => expandedSessions[g.file]);
    if (allExpanded) {
      setExpandedSessions({});
    } else {
      const allOpen: Record<string, boolean> = {};
      visibleSessions.forEach(g => { allOpen[g.file] = true; });
      setExpandedSessions(allOpen);
    }
  }, [sessions, expandedSessions, view]);

  const getSessionItems = (g: DiagnosticReport): Result[] | null => {
    return g.items || loadedItems[g.file] || null;
  };

  const groupByPanel = useCallback((items: Result[]): PanelGroup[] => {
    const loincToPanel: Record<string, number> = {};
    panels.forEach((p, pi) => {
      getPanelAnalyses(p).forEach(loinc => { loincToPanel[loinc] = pi; });
    });

    const panelGroups: Record<number, PanelGroup> = {};
    const ungrouped: Result[] = [];

    for (const r of items) {
      const pi = loincToPanel[r.loinc];
      if (pi !== undefined) {
        if (!panelGroups[pi]) {
          panelGroups[pi] = {
            panelName: getPanelName(panels[pi], uiLang),
            color: panels[pi].color || '#d1d5db',
            results: [],
          };
        }
        panelGroups[pi].results.push(r);
      } else {
        ungrouped.push(r);
      }
    }

    const sorted = Object.keys(panelGroups).map(Number).sort((a, b) => a - b).map(pi => panelGroups[pi]);
    if (ungrouped.length > 0) {
      sorted.push({ panelName: 'Other', color: '#d1d5db', results: ungrouped });
    }
    return sorted;
  }, [panels, uiLang]);

  // Count flagged biomarkers
  const flaggedCounts = useMemo(() => {
    let outCount = 0;
    let allCount = 0;
    for (const session of sessions) {
      if (!session.items) continue;
      for (const r of session.items) {
        if (isOutOfRange(r)) { outCount++; allCount++; }
        else if (isNearOutOfRange(r)) { allCount++; }
      }
    }
    return { outCount, allCount };
  }, [sessions]);

  // Get sessions that have matching results for current filter
  const getVisibleSessions = useCallback((): DiagnosticReport[] => {
    if (view === 'sessions') return sessions;
    return sessions.filter(g => {
      if (!g.items) return false;
      return filterResults(g.items).length > 0;
    });
  }, [sessions, view, filterResults]);

  const visibleSessions = getVisibleSessions();

  const renderSessionCard = (g: DiagnosticReport) => {
    const isExpanded = expandedSessions[g.file];
    const allItems = getSessionItems(g);
    const filteredItems = allItems ? filterResults(allItems) : null;
    const grouped = isExpanded && filteredItems ? groupByPanel(filteredItems) : null;
    const displayCount = view === 'sessions'
      ? g.itemCount
      : (filteredItems ? filteredItems.length : 0);

    return (
      <div key={g.file} className="session-card">
        <div
          className="card"
          onClick={() => toggleSession(g.file, g.items)}
          style={{ borderRadius: isExpanded ? 'var(--radius) var(--radius) 0 0' : undefined }}
        >
          <div className="card-date" style={{ justifyContent: 'space-between' }}>
            <span>
              <strong>{formatDate(g.date, uiLang)}</strong>
              {' · '}
              {g.place || 'Blood Test'}
              {' · '}
              <span style={{ color: 'var(--gray-400)' }}>{displayCount} {t('biomarkers')}</span>
            </span>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <path d="M3 5l4 4 4-4" />
            </svg>
          </div>
        </div>

        {isExpanded && grouped && (
          <div className="results-table" style={{ marginTop: 0, borderRadius: '0 0 var(--radius) var(--radius)' }}>
            {grouped.map((pg, gi) => (
              <div key={gi}>
                <div
                  className="result-panel-divider"
                  style={{ '--row-panel-color': pg.color } as React.CSSProperties}
                >
                  {pg.panelName}
                </div>
                {pg.results.map((r, i) => (
                  <ResultRow key={`${gi}-${i}`} result={r} panelColor={pg.color} />
                ))}
              </div>
            ))}
          </div>
        )}

        {isExpanded && !allItems && (
          <div className="loading" style={{ padding: '16px' }}>Loading...</div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 className="section-title">{t('results')}</h2>

      {!loading && sessions.length > 0 && (
        <div className="view-toggle" style={{ marginBottom: '12px' }}>
          <button
            className={`view-toggle-btn${view === 'sessions' ? ' active' : ''}`}
            onClick={() => setView('sessions')}
          >
            {t('all')} {sessions.reduce((sum, g) => sum + g.itemCount, 0)}
          </button>
          <button
            className={`view-toggle-btn${view === 'near-range' ? ' active' : ''}`}
            onClick={() => setView('near-range')}
            style={{ color: view === 'near-range' ? 'white' : '#d97706' }}
          >
            ⚠ {flaggedCounts.allCount}
          </button>
          <button
            className={`view-toggle-btn${view === 'out-of-range' ? ' active' : ''}`}
            onClick={() => setView('out-of-range')}
            style={{ color: view === 'out-of-range' ? 'white' : '#dc2626' }}
          >
            ⚠ {flaggedCounts.outCount}
          </button>
          <button className="view-toggle-btn utility" onClick={toggleAllSessions}>
            {t('collapseExpandAll')}
          </button>
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}
      {!loading && sessions.length === 0 && (
        <div className="empty-state">{t('noResults')}</div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="card-list">
          {visibleSessions.length === 0 && sessions.length > 0 && (
            <div className="empty-state">All biomarkers are within range 🎉</div>
          )}
          {visibleSessions.map(renderSessionCard)}
        </div>
      )}
    </div>
  );
}
