import { displayUnitOf, fmtNum } from '../../utils/format';
import {
  LOINC_TO_MARKER,
  SI_US_UNIT,
  convertUnit,
  indexBands,
  type IndexBands,
  type IndexDef,
  type SubjectProfile,
} from '../../data/computedIndices';
import { DEFAULT_UNITS } from '../../data/analyteCatalog';
import { toLatinUnit, sameUnitScale } from '../../data/unitNormalization';
import { UNKNOWN_LAB } from '../../data/parseUpload';
import { testLoincs, type Observation } from './markers';
import type { ResultEntry } from './resultsLookup';
import type { Result, UnitSystem } from '../../types';
import { COLOR } from '../../styles/tokens';

export const ZONE_BG = { ok: COLOR.statusOkBg, warn: COLOR.statusWarnBg, bad: COLOR.statusBadBg } as const;
export const SELECTED_ZONE_BG = { ok: COLOR.statusOkBgSelected, warn: COLOR.statusWarnBgSelected, bad: COLOR.statusBadBgSelected } as const;

export const LABEL_COL_WIDTH = 180;

// Fixed layout needs a non-auto width; `separate` borders keep the sticky
// column's `.mc-col-cut` shadow painting over scrolled-under cells.
export const RESULT_TABLE = {
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: 13,
  tableLayout: 'fixed',
  width: '100%',
} as const;

/** The green-zone range as a lab-style reference range; without a profile, every band, sex-labelled. */
export function greenRangeOf(def: IndexDef, profile?: SubjectProfile): string {
  const unit = def.unit ? ` ${def.unit}` : '';
  const format = (b: IndexBands) => `${b.hi ? '>' : '<'} ${fmtNum(b.cut[0])}${unit}`;
  if (profile === undefined && def.bandsBySex) {
    const { male, female } = def.bandsBySex;
    return [male && `men ${format(male)}`, female && `women ${format(female)}`].filter(Boolean).join(' · ');
  }
  const bands = indexBands(def, profile);
  if (bands) return format(bands);
  return def.bandsBySex && !profile?.sex ? 'depends on sex, not set' : 'none';
}

/** `unit` is what the number is on (printed, or the SI/US target); `label` is what to show for it (the stored unit when the file has one). */
type DisplayedResult = { value: number | null; rawValue: string; unit: string; label: string; converted: boolean };

/** Only a spelling is chosen here; the unit itself is always the reading's own, never the row primary's. */
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
 * The number and its unit label always move together: an alias reading keeps
 * its own unit, never the row primary's (ADR-0003), and only a verified SI/US
 * conversion for `marker` (the row's marker, not the reading's code) changes both.
 */
export function displayedResult(
  marker: string | undefined,
  result: Pick<Result, 'loinc' | 'value' | 'rawValue' | 'unit' | 'storedUnit'>,
  unitSystem: UnitSystem
): DisplayedResult {
  const own = ownUnitOf(result);
  const ownLabel = ownUnitOf({ loinc: result.loinc, unit: displayUnitOf(result) });
  const target = marker ? SI_US_UNIT[marker]?.[unitSystem] : undefined;
  if (target && result.value != null) {
    const converted = convertUnit(result.value, marker!, own, target);
    if (converted !== undefined) {
      return { value: converted, rawValue: result.rawValue, unit: target, label: target, converted: true };
    }
  }
  return { value: result.value, rawValue: result.rawValue, unit: own, label: ownLabel, converted: false };
}

/** The spelling most of the readings used; ties go to the earliest column, and no readings name none. */
export function mostCommon(units: readonly string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const unit of units) counts.set(unit, (counts.get(unit) ?? 0) + 1);
  return units.reduce<string | undefined>(
    (best, unit) => (best === undefined || (counts.get(unit) ?? 0) > (counts.get(best) ?? 0) ? unit : best),
    undefined
  );
}

/**
 * The one unit a row can be labelled with, or undefined when the readings sit
 * on two scales. Two spellings of the same unit (ratio exactly 1) are one
 * scale and change no number (ADR-0003); `loinc` settles U vs IU, which
 * depends on the analyte, and omitting it keeps the conservative answer.
 */
export function sharedUnit(units: string[], preferred?: string, loinc?: string): string | undefined {
  const first = units[0];
  if (first === undefined) return undefined;
  if (units.every((u) => u === first)) return first;
  if (!units.every((u) => sameUnitScale(u, first, loinc))) return undefined;
  return preferred && sameUnitScale(preferred, first, loinc) ? preferred : mostCommon(units);
}

export type RowCell = { date: string; match: ResultEntry | null; display: DisplayedResult | null };

/** `rowUnit` labels the row when every reading agrees; otherwise `showCellUnits` moves the unit onto each cell. */
export function buildRowCells(
  test: Observation,
  visibleDates: string[],
  allResults: ResultEntry[],
  unitSystem: UnitSystem
): { cells: RowCell[]; rowUnit: string | undefined; showCellUnits: boolean } {
  const marker = LOINC_TO_MARKER[test.loinc];
  const rowLoincs = testLoincs(test);
  const cells = visibleDates.map((date): RowCell => {
    const match = allResults.find((r) => r.date === date && rowLoincs.includes(r.loinc)) ?? null;
    return { date, match, display: match ? displayedResult(marker, match.result, unitSystem) : null };
  });
  const units = cells.map((c) => c.display?.label).filter((u): u is string => !!u);
  const preferred = (marker && SI_US_UNIT[marker]?.[unitSystem]) || test.unit;
  const shared = sharedUnit(units, preferred, test.loinc);
  return {
    cells,
    rowUnit: units.length > 0 ? shared : preferred,
    showCellUnits: units.length > 0 && shared === undefined,
  };
}

export function cellBg(hasRef: boolean, outOfRange: boolean, selected: boolean): string {
  if (!hasRef) return selected ? COLOR.accentSoft : 'transparent';
  if (outOfRange) return selected ? COLOR.statusBadBgSelected : COLOR.statusBadBg;
  return selected ? COLOR.statusOkBgSelected : COLOR.statusOkBg;
}

/** The one cell "armed" for click-to-select-then-click-to-open, distinct from the row-level `selectedLoinc`. */
export type SelectedCell = { loinc: string; date: string } | null;

export function isCellArmed(selectedCell: SelectedCell, loinc: string, date: string): boolean {
  return selectedCell?.loinc === loinc && selectedCell?.date === date;
}

/** The date columns to show: the most recent N of a newest-first list, oldest to newest. */
export function visibleDatesOf(dates: string[], sampleLimit: number | 'all'): string[] {
  const recent = sampleLimit === 'all' ? dates : dates.slice(0, sampleLimit);
  return [...recent].reverse();
}

/** A printed "—" or "?" in the lab field is a placeholder, not a lab. */
const NAMES_A_LAB = /[\p{L}\p{N}]/u;

/** The lab a reading names, or undefined for an empty field, a placeholder or the format's "Unknown Lab". */
export function namedLab(place: string): string | undefined {
  const name = place.trim();
  return NAMES_A_LAB.test(name) && name !== UNKNOWN_LAB ? name : undefined;
}
