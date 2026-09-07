import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { Analysis, MonitoringPanelDef, Panel } from '../types';
import { ANALYTE_BY_LOINC } from './analyteCatalog';

interface DataContextType {
  analysesCatalog: Record<string, Analysis>;
  /** The laboratory groups a report is ordered as. */
  panels: Panel[];
  /** The product's Monitoring Panels, composed over those groups. */
  monitoringPanels: MonitoringPanelDef[];
  loading: boolean;
}

const DataContext = createContext<DataContextType>(null!);

export function DataProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [monitoringPanels, setMonitoringPanels] = useState<MonitoringPanelDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('./data/panels.json').then(r => r.json()),
      fetch('./data/monitoring-panels.json').then(r => r.json()),
    ]).then(([panelsData, monitoringData]: [Panel[], MonitoringPanelDef[]]) => {
      setPanels(panelsData);
      setMonitoringPanels(monitoringData);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({ analysesCatalog: ANALYTE_BY_LOINC, panels, monitoringPanels, loading }),
    [panels, monitoringPanels, loading]
  );

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
