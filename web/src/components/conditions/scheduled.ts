import { useCallback, useEffect, useState } from 'react';
import { MARKER_LOINC } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import { isMonthKey, monthKeyOf } from '../../data/months';
import { LABORATORIES } from '../../data/labPricing';
import { LOINC_TO_MARKER } from './markers';

// Which observations (by LOINC) and computed indices (by key) are marked for
// the next draw -- one global list across every panel, persisted so it
// survives a refresh.
export const SCHEDULED_KEY = 'bloodtests_scheduled_v1';
// `month` (ISO YYYY-MM) LABELS the one global schedule -- "these are the tests
// I plan to order for March 2027". It does not partition it: changing the month
// leaves every checked row checked. Stored as YYYY-MM because it is a calendar
// month, not an instant: it sorts lexicographically, needs no timezone, and is
// what an <input type="month"> would have produced anyway.
// Stored schedules and backups may still carry a `lab` key from when the
// schedule was costed at one laboratory; it is ignored like any unknown field.
// `selectedLabId` is a distinct, newer field -- the one laboratory the owner is
// actually going to for this visit, used to swap row labels to that lab's own
// product names. It does not collide with the retired `lab` key's name, so an
// old backup's stray `lab` value stays correctly ignored rather than being
// picked up as a selection.
export type Scheduled = { loincs: string[]; indices: string[]; month?: string; selectedLabId?: string };
export const EMPTY_SCHEDULED: Scheduled = { loincs: [], indices: [] };

function isLabId(value: unknown): value is string {
  return typeof value === 'string' && LABORATORIES.some((lab) => lab.id === value);
}

/** How many of a table's rows are scheduled, for the header's tri-state box. */
export type SelectionState = 'none' | 'some' | 'all';

/** The Scheduled column's wiring, handed to every table that renders one. */
export type RowScheduling = {
  scheduled: Scheduled;
  onToggle: (loincs: string[]) => void;
  /** Select-all over exactly the observation rows the table is showing. */
  onToggleAll: (rows: string[][], on: boolean) => void;
  onSetMonth: (month: string | undefined) => void;
};
export type IndexScheduling = {
  scheduled: Scheduled;
  onToggle: (key: string) => void;
  onSetMonth: (month: string | undefined) => void;
};

export function loadScheduled(): Scheduled {
  try {
    return parseScheduled(localStorage.getItem(SCHEDULED_KEY));
  } catch {
    return { ...EMPTY_SCHEDULED };
  }
}

/** Whether a payload from outside (a backup) has the stored shape at all, before parseScheduled forgives its entries. */
export function isScheduledShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const scheduled = value as Record<string, unknown>;
  return Array.isArray(scheduled.loincs) && Array.isArray(scheduled.indices);
}

/** A stored schedule read back; anything missing or malformed reads as empty. */
export function parseScheduled(raw: string | null): Scheduled {
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Scheduled>;
      return {
        loincs: Array.isArray(parsed.loincs) ? parsed.loincs.filter((x): x is string => typeof x === 'string') : [],
        indices: Array.isArray(parsed.indices) ? parsed.indices.filter((x): x is string => typeof x === 'string') : [],
        month: isMonthKey(parsed.month) ? parsed.month : undefined,
        selectedLabId: isLabId(parsed.selectedLabId) ? parsed.selectedLabId : undefined,
      };
    }
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return { ...EMPTY_SCHEDULED };
}

export function saveScheduled(scheduled: Scheduled): void {
  try {
    localStorage.setItem(SCHEDULED_KEY, JSON.stringify(scheduled));
  } catch {
    // storage unavailable (private browsing, quota) -- schedule just won't persist
  }
}

// A row's identity for scheduling is its analyte, not one lab's code: every
// LOINC the same marker is reported under travels together, so a row keyed
// under an alternate code still reads as scheduled.
function withSiblings(loincs: string[]): string[] {
  return Array.from(
    new Set(
      loincs.flatMap((loinc) => {
        const marker = LOINC_TO_MARKER[loinc];
        return [loinc, ...(marker ? MARKER_LOINC[marker] ?? [] : [])];
      })
    )
  );
}

/** Every LOINC a computed index reads its inputs from. */
export function indexInputLoincs(key: string): string[] {
  const def = INDEX_DEFS.find((d) => d.key === key);
  return Array.from(new Set(def?.inputKeys.flatMap((inputKey) => MARKER_LOINC[inputKey] ?? []) ?? []));
}

/** Whether a row answering for any of `loincs` is scheduled. */
export function isRowScheduled(scheduled: Scheduled, loincs: string[]): boolean {
  return loincs.some((loinc) => scheduled.loincs.includes(loinc));
}

export function isIndexScheduled(scheduled: Scheduled, key: string): boolean {
  return scheduled.indices.includes(key);
}

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

// An index is scheduled exactly when every marker it needs is: derived afresh
// from the observation list whenever an observation toggles, so a stored
// index never outlives its inputs.
function deriveIndices(loincs: string[]): string[] {
  return INDEX_DEFS.filter((def) =>
    def.inputKeys.every((inputKey) => (MARKER_LOINC[inputKey] ?? []).some((loinc) => loincs.includes(loinc)))
  ).map((def) => def.key);
}

/** Toggling an observation re-derives every index from its inputs. */
export function toggleRow(scheduled: Scheduled, loincs: string[]): Scheduled {
  const all = withSiblings(loincs);
  const next = isRowScheduled(scheduled, all)
    ? scheduled.loincs.filter((loinc) => !all.includes(loinc))
    : union(scheduled.loincs, all);
  return { ...scheduled, loincs: next, indices: deriveIndices(next) };
}

/** Scheduling an index also schedules its inputs; unscheduling leaves them alone. */
export function toggleIndex(scheduled: Scheduled, key: string): Scheduled {
  if (isIndexScheduled(scheduled, key)) {
    return { ...scheduled, indices: scheduled.indices.filter((k) => k !== key) };
  }
  return {
    ...scheduled,
    loincs: union(scheduled.loincs, indexInputLoincs(key)),
    indices: [...scheduled.indices, key],
  };
}

/** Select-all over the observation rows on screen: one row's rule applied to all of them at once. */
export function setRowsScheduled(scheduled: Scheduled, rows: string[][], on: boolean): Scheduled {
  const all = withSiblings(rows.flat());
  const next = on ? union(scheduled.loincs, all) : scheduled.loincs.filter((loinc) => !all.includes(loinc));
  return { ...scheduled, loincs: next, indices: deriveIndices(next) };
}

export function setScheduleMonth(scheduled: Scheduled, month: string | undefined): Scheduled {
  return { ...scheduled, month: isMonthKey(month) ? month : undefined };
}

/** The one laboratory the owner is actually going to for this visit, or undefined to fall back to generic names. */
export function setSelectedLab(scheduled: Scheduled, labId: string | undefined): Scheduled {
  return { ...scheduled, selectedLabId: isLabId(labId) ? labId : undefined };
}

export function selectionState(flags: readonly boolean[]): SelectionState {
  if (flags.every((f) => !f)) return 'none';
  return flags.every(Boolean) ? 'all' : 'some';
}

/** The picker's choices: this month and the next `count`, plus a stored month that has since fallen outside that window. */
export function monthChoices(today: Date, count: number, selected?: string): string[] {
  const months: string[] = [];
  for (let i = 0; i <= count; i++) {
    months.push(monthKeyOf(new Date(today.getFullYear(), today.getMonth() + i, 1)));
  }
  if (isMonthKey(selected) && !months.includes(selected)) months.push(selected);
  return months.sort((a, b) => a.localeCompare(b));
}

export function useScheduled() {
  const [scheduled, setScheduled] = useState<Scheduled>(loadScheduled);

  useEffect(() => {
    saveScheduled(scheduled);
  }, [scheduled]);

  const onToggleRow = useCallback((loincs: string[]) => setScheduled((s) => toggleRow(s, loincs)), []);
  const onToggleIndex = useCallback((key: string) => setScheduled((s) => toggleIndex(s, key)), []);
  const onToggleAllRows = useCallback(
    (rows: string[][], on: boolean) => setScheduled((s) => setRowsScheduled(s, rows, on)),
    []
  );
  const onSetMonth = useCallback((month: string | undefined) => setScheduled((s) => setScheduleMonth(s, month)), []);
  const onSelectLab = useCallback((labId: string | undefined) => setScheduled((s) => setSelectedLab(s, labId)), []);
  const onReload = useCallback(() => setScheduled(loadScheduled()), []);

  return { scheduled, onToggleRow, onToggleIndex, onToggleAllRows, onSetMonth, onSelectLab, onReload };
}
