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
// Saturated dot colors for the same 3 zones, for compact list rows (e.g. the
// Monitoring Panels grid card) where ZONE_BG's pale backgrounds would be too
// faint to read as a small dot. ok/bad reuse STATUS_STYLES' green/red so the
// two-state and three-state dots read as one color language; warn is Google's
// amber, completing the same red/yellow/green triad.
export const ZONE_DOT = { ok: '#34a853', warn: '#fbbc04', bad: '#ea4335' } as const;

export const PANEL_PADDING = 20;
export const PANEL_GAP = 24;
export const PANEL_WIDTH = 316;

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
export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = { unitSystem: 'si', sampleLimit: 5, dateOrder: 'asc' };

export function loadAnalysisSettings(): AnalysisSettings {
  try {
    const raw = localStorage.getItem(ANALYSIS_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_ANALYSIS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return { ...DEFAULT_ANALYSIS_SETTINGS };
}

/** Whether the visitor already made their own choice -- share-link settings only seed when they haven't. */
export function hasStoredAnalysisSettings(): boolean {
  try {
    return localStorage.getItem(ANALYSIS_SETTINGS_KEY) !== null;
  } catch {
    return false;
  }
}

/** Share-link settings applied over the defaults: a starting point, never an override. */
export function seedAnalysisSettings(seed: Partial<AnalysisSettings> | undefined): AnalysisSettings {
  return { ...DEFAULT_ANALYSIS_SETTINGS, ...(seed ?? {}) };
}

/**
 * Props that make a styled non-native element (div/span/td used as a control)
 * keyboard-activatable: role, tab stop, and Enter/Space triggering the same
 * handler as click (Sonar S6848/S1082).
 */
export function pressable(handler: (e: { currentTarget: HTMLElement }) => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: handler,
    onKeyDown: (e: { key: string; preventDefault: () => void; currentTarget: HTMLElement }) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler(e);
      }
    },
  };
}

/** Background for a result cell: reference presence, range status, row selection. */
export function cellBg(hasRef: boolean, outOfRange: boolean, selected: boolean): string {
  if (!hasRef) return selected ? '#eaf3fb' : 'transparent';
  if (outOfRange) return selected ? '#e6e8f0' : '#fdecea';
  return selected ? '#dbecf0' : '#e6f4ea';
}

// A cell-level selection: which one data cell (row identity + date) is
// "armed" for the click-to-select-then-click-to-open interaction, distinct
// from the row-level `selectedLoinc` that drives the row highlight.
export type SelectedCell = { loinc: string; date: string } | null;

/** Whether the given (row identity, date) cell is the currently armed one. */
export function isCellArmed(selectedCell: SelectedCell, loinc: string, date: string): boolean {
  return selectedCell?.loinc === loinc && selectedCell?.date === date;
}

/** The date columns to show, applying the sampling limit and column order. */
export function visibleDatesOf(dates: string[], sampleLimit: number | 'all', dateOrder: 'asc' | 'desc'): string[] {
  const recent = sampleLimit === 'all' ? dates : dates.slice(0, sampleLimit);
  return dateOrder === 'asc' ? [...recent].reverse() : recent;
}

/** Where to anchor a popup opened from the given element, for the given width. */
export function popupPosition(
  rect: DOMRect,
  width: number
): { left: number; top?: number; bottom?: number } {
  const center = rect.left + rect.width / 2;
  const left = Math.min(Math.max(center - width / 2, 8), window.innerWidth - width - 8);
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  // Open upward when there's little room below and more room above --
  // keeps the popup from running off the bottom of the viewport for a
  // row near the end of a long page.
  if (spaceBelow < 200 && spaceAbove > spaceBelow) {
    return { left, bottom: window.innerHeight - rect.top + 8 };
  }
  return { left, top: rect.bottom + 8 };
}
