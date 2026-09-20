export type UnitSystem = 'si' | 'us';

export interface Analysis {
  loinc: string;
  longCommonName: string;
  friendlyName: string;
  /** Our badge abbreviation, not LOINC's SHORTNAME. */
  shortName?: string;
  unit?: string;
  /** A LOINC fixes the quantity, not the scale. */
  allowedUnits?: string[];
  /** The primary code that owns this variant's row. */
  aliasOf?: string;
  aliasLabel?: string;
  lang: Record<string, string>;
  info?: AnalysisInfo;
}

export interface LoincRef {
  aliasLabel: string;
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
  /** Exactly as the lab printed it. */
  rawName: string;
  section: string;
  value: number | null;
  rawValue: string;
  valueQualifier: string;
  /** As the lab printed it (`rawUnit`), or the file's `unit` when nothing was printed separately. */
  unit: string;
  /** The file's normalized `unit` when it sits beside a different `rawUnit`; the unit checks read it before `unit`. */
  storedUnit?: string;
  refText: string;
  refMin: number | null;
  refMax: number | null;
  method: string;
  /** Derived at import; never exported, and `value`/`unit` stay as printed (ADR-0003). */
  canonical?: { value: number; unit: string };
}

/** Where a session's report lives in the held stored files: the file and its position in `diagnosticReports`. */
export interface ReportSource {
  path: string;
  index: number;
}

export interface DiagnosticReport {
  date: string;
  place: string;
  file: string; // stable session id
  items: Result[] | null;
  itemCount: number;
  source?: ReportSource;
}
