export interface Analysis {
  loinc: string;
  longCommonName: string;
  displayName: string;
  lang: Record<string, string>;
  info?: AnalysisInfo;
}

export interface AnalysisInfo {
  description?: string;
  scientific?: string;
  why?: string;
  frequency?: string;
  lang?: Record<string, Partial<AnalysisInfo>>;
}

export interface PanelSection {
  name: string;
  lang: Record<string, string>;
  loincs: string[];
}

export interface Panel {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  iconFile?: string;
  lang: Record<string, string>;
  loincs?: string[];
  sections?: PanelSection[];
}

export interface Result {
  loinc: string;
  analysis: string;
  symbol: string;
  section: string;
  value: number | null;
  rawValue: string;
  valueQualifier: string;
  unit: string;
  refText: string;
  refMin: number | null;
  refMax: number | null;
  method: string;
}

export interface ResultGroup {
  date: string;
  place: string;
  file: string; // stable id for this session, derived from date + place
  items: Result[] | null;
  itemCount: number;
}

export type ViewName = 'panels' | 'panel-detail' | 'results' | 'analytics';
export type PanelViewMode = 'minimal' | 'compact' | 'detailed';
export type Lang = 'en' | 'ru-RU' | 'uk-UA';
