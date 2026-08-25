import { fmtNum } from '../../utils/format';
import type { IndexDef } from '../../data/computedIndices';

export const STATUS_STYLES = {
  'never': { border: '#ccc', background: '#f5f5f5', color: '#999' },
  'in-range': { border: '#34a853', background: '#e6f4ea', color: '#1a1a1a' },
  'out-of-range': { border: '#ea4335', background: '#fdecea', color: '#1a1a1a' },
  'unknown': { border: '#1971c2', background: 'transparent', color: '#1a1a1a' },
} as const;

// 3-zone coloring for computed indices (see data/computedIndices.ts's `zone()`).
export const ZONE_BG = { ok: '#e6f4ea', warn: '#fff4e0', bad: '#fdecea' } as const;
// Selected-row variants, blended with the row-selection blue (#eaf3fb).
export const SELECTED_ZONE_BG = { ok: '#dbecf0', warn: '#e7ecea', bad: '#e6e8f0' } as const;

export const BADGE_WIDTH = 84;
export const BADGE_GAP = 12;
export const PANEL_PADDING = 20;
export const PANEL_GAP = 24;
export const PANEL_WIDTH = BADGE_WIDTH * 3 + BADGE_GAP * 2 + PANEL_PADDING * 2;

export const POPUP_WIDTH = 260;
export const INDEX_POPUP_WIDTH = 380;

export function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = String(d.getFullYear()).slice(-2);
  return `${month} ${year}`;
}

// The optimal (green-zone) range implied by an index's cut-points, formatted
// like a lab reference range -- same orientation `zone()` uses to color a cell.
export function greenRangeOf(def: IndexDef): string {
  const cmp = def.hi ? '>' : '<';
  const unit = def.unit ? ` ${def.unit}` : '';
  return `${cmp} ${fmtNum(def.cut[0])}${unit}`;
}

// The table controls (unit system, samplings shown, column order) are one
// shared setting across every panel and All Observations (component-level
// state, not per-panel) -- persisted here so they also survive a page refresh.
export const ANALYSIS_SETTINGS_KEY = 'bloodtests_analysis_settings_v1';
export type AnalysisSettings = { unitSystem: 'si' | 'us'; sampleLimit: number | 'all'; dateOrder: 'asc' | 'desc' };
const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = { unitSystem: 'si', sampleLimit: 'all', dateOrder: 'desc' };

export function loadAnalysisSettings(): AnalysisSettings {
  try {
    const raw = localStorage.getItem(ANALYSIS_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_ANALYSIS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return DEFAULT_ANALYSIS_SETTINGS;
}
