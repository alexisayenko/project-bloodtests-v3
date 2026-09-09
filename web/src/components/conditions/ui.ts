import { fmtNum } from '../../utils/format';
import { SI_US_UNIT, convertUnit, type IndexDef } from '../../data/computedIndices';
import { DEFAULT_UNITS } from '../../data/analyteCatalog';
import { toLatinUnit, sameUnitScale } from '../../data/unitNormalization';
import { LOINC_TO_MARKER, testLoincs, type Observation } from './markers';
import type { ResultEntry } from './resultsLookup';
import type { Result } from '../../types';

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

export function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// The optimal (green-zone) range implied by an index's cut-points, formatted
// like a lab reference range -- same orientation `zone()` uses to color a cell.
export function greenRangeOf(def: IndexDef): string {
  const cmp = def.hi ? '>' : '<';
  const unit = def.unit ? ` ${def.unit}` : '';
  return `${cmp} ${fmtNum(def.cut[0])}${unit}`;
}

// The table controls (unit system, samplings shown) are one shared setting
// across every panel and All Observations (component-level state, not
// per-panel) -- persisted here so they also survive a page refresh.
export const VIEW_SETTINGS_KEY = 'bloodtests_view_settings_v1';
export type ViewSettings = { unitSystem: 'si' | 'us'; sampleLimit: number | 'all' };
export const DEFAULT_VIEW_SETTINGS: ViewSettings = { unitSystem: 'si', sampleLimit: 5 };

export type ControlsTab = 'analysis' | 'trends' | 'in-range' | 'charts';
export type ControlsEnabled = { unitSystem: boolean; sampleLimit: boolean; filters: boolean };

/**
 * ControlsBar sits above the tab strip, so a control the active tab does not
 * read is disabled rather than hidden -- hiding one would change the bar's
 * height as you switch tabs. "What's in range" reads the unit system and
 * nothing else; Trends and Charts read none of it.
 */
export function controlsForTab(tab: ControlsTab): ControlsEnabled {
  return {
    unitSystem: tab === 'analysis' || tab === 'in-range',
    sampleLimit: tab === 'analysis',
    filters: tab === 'analysis',
  };
}

export function loadViewSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(VIEW_SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<ViewSettings>;
      return {
        unitSystem: stored.unitSystem ?? DEFAULT_VIEW_SETTINGS.unitSystem,
        sampleLimit: stored.sampleLimit ?? DEFAULT_VIEW_SETTINGS.sampleLimit,
      };
    }
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return { ...DEFAULT_VIEW_SETTINGS };
}

/** Persist the shared table controls, dropping any value outside the accepted set. */
export function saveViewSettings(settings: ViewSettings): void {
  const { unitSystem, sampleLimit } = settings;
  const validLimit =
    sampleLimit === 'all' || (typeof sampleLimit === 'number' && Number.isFinite(sampleLimit) && sampleLimit > 0);
  const safe: ViewSettings = {
    unitSystem: unitSystem === 'us' ? 'us' : 'si',
    sampleLimit: validLimit ? sampleLimit : DEFAULT_VIEW_SETTINGS.sampleLimit,
  };
  try {
    localStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify(safe));
  } catch {
    // storage unavailable (private browsing, quota) -- setting just won't persist
  }
}

/** Whether the visitor already made their own choice -- share-link settings only seed when they haven't. */
export function hasStoredViewSettings(): boolean {
  try {
    return localStorage.getItem(VIEW_SETTINGS_KEY) !== null;
  } catch {
    return false;
  }
}

/** Share-link settings applied over the defaults: a starting point, never an override. */
export function seedViewSettings(seed: Partial<ViewSettings> | undefined): ViewSettings {
  return { ...DEFAULT_VIEW_SETTINGS, ...seed };
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

/**
 * The active/inactive look shared by the top nav and the in-page tab strips.
 * The bold of an active tab is a text-shadow rather than a fontWeight: a real
 * weight change is wider, so switching tabs would shift its neighbours.
 */
export function tabStyle(active: boolean) {
  return {
    borderBottom: active ? '2px solid #1971c2' : '2px solid transparent',
    textShadow: active ? '0.3px 0 currentColor, -0.3px 0 currentColor' : 'none',
    color: active ? '#1971c2' : '#555',
  };
}

/** What one reading is displayed as: a number and the unit it is labelled with. */
export type DisplayedResult = { value: number | null; rawValue: string; unit: string; converted: boolean };

/**
 * The reading's own printed unit, in the app's spelling of it: the catalog's
 * own form when the print means the same unit ("mcg/dL", "мкг/дл"), otherwise
 * the canonical Latin form, otherwise the print verbatim. Only a SPELLING is
 * chosen here -- the unit itself is always the one the reading carries, and
 * with nothing printed it is the reading's OWN code's expected unit, never the
 * unit of the primary whose row it happens to fold into.
 */
function ownUnitOf(result: Pick<Result, 'loinc' | 'unit'>): string {
  const expected = DEFAULT_UNITS[result.loinc];
  const printed = result.unit?.trim();
  if (!printed) return expected ?? '';
  const latin = toLatinUnit(printed);
  if (latin === undefined) return printed;
  if (expected && toLatinUnit(expected) === latin) return expected;
  return latin;
}

/**
 * The number and the unit label always move together. A reading recorded under
 * a unit-variant alias (e.g. VLDL-C's molar 25371-6 folded into mass 13458-5's
 * row) keeps ITS OWN unit, never the row's primary one -- pairing a printed
 * value with another code's unit is exactly the mislabel ADR-0003 forbids.
 * Only a verified SI/US conversion for this marker may change the number, and
 * then the label changes with it; where no such conversion exists the reading
 * stays as printed, unit included.
 *
 * `marker` is the row's marker (markers.ts's LOINC_TO_MARKER), not the
 * reading's code: an alias is the same analyte, so its molar reading converts
 * on the primary's rules.
 */
export function displayedResult(
  marker: string | undefined,
  result: Pick<Result, 'loinc' | 'value' | 'rawValue' | 'unit'>,
  unitSystem: 'si' | 'us'
): DisplayedResult {
  const own = ownUnitOf(result);
  const target = marker ? SI_US_UNIT[marker]?.[unitSystem] : undefined;
  if (target && result.value != null) {
    const converted = convertUnit(result.value, marker!, own, target);
    if (converted !== undefined) {
      return { value: converted, rawValue: result.rawValue, unit: target, converted: true };
    }
  }
  return { value: result.value, rawValue: result.rawValue, unit: own, converted: false };
}

/** The spelling most of the readings used; ties go to the earliest column. */
function mostCommon(units: string[]): string {
  const counts = new Map<string, number>();
  for (const unit of units) counts.set(unit, (counts.get(unit) ?? 0) + 1);
  return units.reduce((best, unit) => ((counts.get(unit) ?? 0) > (counts.get(best) ?? 0) ? unit : best));
}

/**
 * The single unit a set of displayed cells can be labelled with, or undefined
 * when they disagree -- a row whose readings sit on two scales (a lab that
 * switched from mg/dL to umol/L mid-history) gets no row-level unit at all,
 * and each cell carries its own instead.
 *
 * Two spellings of the SAME unit are not a disagreement: uIU/mL and mIU/L are
 * the identical unit (ratio 1), so a TSH history printed both ways is one
 * scale and carries one label. That is a comparison of computed scale
 * (`sameUnitScale`), never of spelling, and it changes no number -- a pair
 * whose ratio is anything but exactly 1 still splits onto the cells, because
 * converting to force a shared label is what ADR-0003 rules out. `preferred`
 * (the row's own catalog/SI-US unit) picks the spelling when it belongs to the
 * same unit; otherwise the readings' own majority spelling does.
 */
export function sharedUnit(units: string[], preferred?: string): string | undefined {
  const first = units[0];
  if (first === undefined) return undefined;
  if (units.every((u) => u === first)) return first;
  if (!units.every((u) => sameUnitScale(u, first))) return undefined;
  return preferred && sameUnitScale(preferred, first) ? preferred : mostCommon(units);
}

/** One visible date column of an observation row: the reading, if any, as displayed. */
export type RowCell = { date: string; match: ResultEntry | null; display: DisplayedResult | null };

/**
 * An observation row's cells plus the unit to label them with. `rowUnit` labels
 * the whole row when every reading agrees; when they don't -- a lab that
 * switched scales mid-history, or a mass code and its molar alias folded into
 * one row -- `showCellUnits` moves the unit onto each cell instead, so a number
 * is never shown under another reading's unit. A reading with no unit at all
 * makes no competing claim and stays out of that comparison. With no readings
 * to speak for the row, the label falls back to the SI/US target, then to the
 * row's own catalog unit.
 */
export function buildRowCells(
  test: Observation,
  visibleDates: string[],
  allResults: ResultEntry[],
  unitSystem: 'si' | 'us'
): { cells: RowCell[]; rowUnit: string | undefined; showCellUnits: boolean } {
  const marker = LOINC_TO_MARKER[test.loinc];
  const rowLoincs = testLoincs(test);
  const cells = visibleDates.map((date): RowCell => {
    const match = allResults.find((r) => r.date === date && rowLoincs.includes(r.loinc)) ?? null;
    return { date, match, display: match ? displayedResult(marker, match.result, unitSystem) : null };
  });
  const units = cells.map((c) => c.display?.unit).filter((u): u is string => !!u);
  const preferred = (marker && SI_US_UNIT[marker]?.[unitSystem]) || test.unit;
  const shared = sharedUnit(units, preferred);
  return {
    cells,
    rowUnit: units.length > 0 ? shared : preferred,
    showCellUnits: units.length > 0 && shared === undefined,
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

/** The date columns to show: the most recent N of a newest-first list, oldest to newest. */
export function visibleDatesOf(dates: string[], sampleLimit: number | 'all'): string[] {
  const recent = sampleLimit === 'all' ? dates : dates.slice(0, sampleLimit);
  return [...recent].reverse();
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
