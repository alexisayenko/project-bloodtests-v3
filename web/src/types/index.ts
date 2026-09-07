export interface Analysis {
  loinc: string;
  longCommonName: string;
  displayName: string;
  /** Badge label shown in Monitoring Panels and All Observations. */
  short?: string;
  /** The unit this analyte is expected in — the reference for unit checks. */
  unit?: string;
  /** Further units accepted for the same code (a LOINC fixes the quantity, not the scale). */
  allowedUnits?: string[];
  /** Set when this entry is a unit or method variant of another code, which owns the row. */
  aliasOf?: string;
  /** How this variant differs from its primary, e.g. "nmol/L unit". */
  aliasLabel?: string;
  lang: Record<string, string>;
  info?: AnalysisInfo;
}

/** A variant code shown alongside its primary marker (see Analysis.aliasOf). */
export interface LoincRef {
  label: string;
  loinc: string;
  longCommonName: string;
  unit: string;
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

/**
 * One Monitoring Panel's composition over the lab groups in panels.json:
 * `panelId`/`panelIds` pull a group's LOINCs in, `loincs` states them
 * outright, then `excludeLoincs` and `extraLoincs` adjust the result.
 */
export interface MonitoringPanelDef {
  name: string;
  panelId?: string;
  panelIds?: string[];
  loincs?: string[];
  excludeLoincs?: string[];
  extraLoincs?: string[];
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

export interface DiagnosticReport {
  date: string;
  place: string;
  file: string; // stable id for this session, derived from date + place
  items: Result[] | null;
  itemCount: number;
}

export type ViewName = 'panels' | 'panel-detail' | 'results' | 'analytics';
export type PanelViewMode = 'minimal' | 'compact' | 'detailed';
export type Lang = 'en' | 'ru-RU' | 'uk-UA';
