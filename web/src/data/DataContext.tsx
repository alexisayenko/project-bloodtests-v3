import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Analysis, Panel } from '../types';

interface DataContextType {
  analysesCatalog: Record<string, Analysis>;
  panels: Panel[];
  loading: boolean;
}

const DataContext = createContext<DataContextType>(null!);

export function DataProvider({ children }: { children: ReactNode }) {
  const [analysesCatalog, setAnalysesCatalog] = useState<Record<string, Analysis>>({});
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('./data/analyses.json').then(r => r.json()),
      fetch('./data/panels.json').then(r => r.json()),
    ]).then(([analyses, panelsData]: [Analysis[], Panel[]]) => {
      const catalog: Record<string, Analysis> = {};
      analyses.forEach(a => { catalog[a.loinc] = a; });
      setAnalysesCatalog(catalog);
      setPanels(panelsData);
      setLoading(false);
    });
  }, []);

  return (
    <DataContext.Provider value={{ analysesCatalog, panels, loading }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
