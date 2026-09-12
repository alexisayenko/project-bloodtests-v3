import { useCallback, useEffect, useState } from 'react';
import { MARKER_LOINC } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import { isMonthKey, monthKeyOf } from '../../data/months';
import { LABORATORIES } from '../../data/labPricing';
import { newRowId } from '../../data/ids';
import { LOINC_TO_MARKER } from './markers';

// Which observations (by LOINC) and computed indices (by key) are marked for
// a draw -- one list per scheduled visit, each with its own target month and
// laboratory, persisted together so they survive a refresh.
export const SCHEDULED_KEY = 'bloodtests_scheduled_v1';
// `month` (ISO YYYY-MM) LABELS a visit's schedule -- "these are the tests I
// plan to order for March 2027". It does not partition it: changing the month
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
export type ScheduledVisit = { id: string; loincs: string[]; indices: string[]; month?: string; selectedLabId?: string };
// The stored shape: a list of independent visits. Before this existed, storage
// held exactly one such object with no `id` and no wrapping list -- see the
// migration in parseScheduled.
export type ScheduledVisits = { visits: ScheduledVisit[] };
export const EMPTY_SCHEDULED_VISITS: ScheduledVisits = { visits: [] };

function emptyVisit(id: string): ScheduledVisit {
  return { id, loincs: [], indices: [] };
}

function isLabId(value: unknown): value is string {
  return typeof value === 'string' && LABORATORIES.some((lab) => lab.id === value);
}

function isStr(value: unknown): value is string {
  return typeof value === 'string';
}

/** One visit's Scheduled column wiring, handed to every table that renders it. */
export type RowScheduling = {
  scheduled: ScheduledVisit;
  onToggle: (loincs: string[]) => void;
  onSetMonth: (month: string | undefined) => void;
  onRemove: () => void;
};
export type IndexScheduling = {
  scheduled: ScheduledVisit;
  onToggle: (key: string) => void;
  onSetMonth: (month: string | undefined) => void;
  onRemove: () => void;
};

/** Fields shared by the pre-redesign single-schedule shape and one stored visit. */
type StoredFields = { loincs: string[]; indices: string[]; month?: string; selectedLabId?: string };

function parseStoredFields(value: Record<string, unknown>): StoredFields {
  return {
    loincs: Array.isArray(value.loincs) ? value.loincs.filter(isStr) : [],
    indices: Array.isArray(value.indices) ? value.indices.filter(isStr) : [],
    month: isMonthKey(value.month) ? value.month : undefined,
    selectedLabId: isLabId(value.selectedLabId) ? value.selectedLabId : undefined,
  };
}

function isEmptyFields(fields: StoredFields): boolean {
  return fields.loincs.length === 0 && fields.indices.length === 0 && fields.month === undefined && fields.selectedLabId === undefined;
}

function parseVisit(value: unknown): ScheduledVisit | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id === '') return undefined;
  return { id: v.id, ...parseStoredFields(v) };
}

export function loadScheduled(): ScheduledVisits {
  try {
    return parseScheduled(localStorage.getItem(SCHEDULED_KEY));
  } catch {
    return { ...EMPTY_SCHEDULED_VISITS };
  }
}

/** Whether a payload from outside (a backup) has the stored shape at all, before parseScheduled forgives its entries -- either the current visits list or the pre-redesign single schedule. */
export function isScheduledShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.visits)) return true;
  return Array.isArray(v.loincs) && Array.isArray(v.indices);
}

/**
 * A stored schedule read back; anything missing or malformed reads as empty.
 * A payload from before multiple visits existed -- one schedule object with no
 * `visits` array -- migrates transparently into a list of exactly one visit,
 * carrying its loincs/indices/month/selectedLabId over as-is under a fresh id;
 * an old payload that was itself fully empty migrates to an empty list rather
 * than manufacturing a pointless visit.
 */
export function parseScheduled(raw: string | null): ScheduledVisits {
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray(parsed.visits)) {
        return { visits: parsed.visits.map(parseVisit).filter((v): v is ScheduledVisit => !!v) };
      }
      const legacy = parseStoredFields(parsed);
      return isEmptyFields(legacy) ? { visits: [] } : { visits: [{ id: newRowId(), ...legacy }] };
    }
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return { ...EMPTY_SCHEDULED_VISITS };
}

export function saveScheduled(scheduled: ScheduledVisits): void {
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

/** Whether a row answering for any of `loincs` is scheduled in this visit. */
export function isRowScheduled(visit: ScheduledVisit, loincs: string[]): boolean {
  return loincs.some((loinc) => visit.loincs.includes(loinc));
}

export function isIndexScheduled(visit: ScheduledVisit, key: string): boolean {
  return visit.indices.includes(key);
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

function updateVisit(scheduled: ScheduledVisits, visitId: string, fn: (visit: ScheduledVisit) => ScheduledVisit): ScheduledVisits {
  return { visits: scheduled.visits.map((v) => (v.id === visitId ? fn(v) : v)) };
}

/** Adds a fresh, empty visit -- no month, no rows -- to the end of the list. */
export function addVisit(scheduled: ScheduledVisits, id: string): ScheduledVisits {
  return { visits: [...scheduled.visits, emptyVisit(id)] };
}

/** Drops a visit entirely, unscheduling everything it had. The others are untouched. */
export function removeVisit(scheduled: ScheduledVisits, visitId: string): ScheduledVisits {
  return { visits: scheduled.visits.filter((v) => v.id !== visitId) };
}

/** Toggling an observation re-derives that visit's indices from its inputs; the other visits are untouched. */
export function toggleRow(scheduled: ScheduledVisits, visitId: string, loincs: string[]): ScheduledVisits {
  return updateVisit(scheduled, visitId, (visit) => {
    const all = withSiblings(loincs);
    const next = isRowScheduled(visit, all) ? visit.loincs.filter((loinc) => !all.includes(loinc)) : union(visit.loincs, all);
    return { ...visit, loincs: next, indices: deriveIndices(next) };
  });
}

/** Scheduling an index also schedules its inputs, in the same visit; unscheduling leaves them alone. */
export function toggleIndex(scheduled: ScheduledVisits, visitId: string, key: string): ScheduledVisits {
  return updateVisit(scheduled, visitId, (visit) => {
    if (isIndexScheduled(visit, key)) {
      return { ...visit, indices: visit.indices.filter((k) => k !== key) };
    }
    return { ...visit, loincs: union(visit.loincs, indexInputLoincs(key)), indices: [...visit.indices, key] };
  });
}

/** Select-all over the observation rows on screen, for one visit: one row's rule applied to all of them at once. */
export function setRowsScheduled(scheduled: ScheduledVisits, visitId: string, rows: string[][], on: boolean): ScheduledVisits {
  return updateVisit(scheduled, visitId, (visit) => {
    const all = withSiblings(rows.flat());
    const next = on ? union(visit.loincs, all) : visit.loincs.filter((loinc) => !all.includes(loinc));
    return { ...visit, loincs: next, indices: deriveIndices(next) };
  });
}

export function setScheduleMonth(scheduled: ScheduledVisits, visitId: string, month: string | undefined): ScheduledVisits {
  return updateVisit(scheduled, visitId, (visit) => ({ ...visit, month: isMonthKey(month) ? month : undefined }));
}

/** The one laboratory the owner is actually going to for this visit, or undefined to fall back to generic names. */
export function setSelectedLab(scheduled: ScheduledVisits, visitId: string, labId: string | undefined): ScheduledVisits {
  return updateVisit(scheduled, visitId, (visit) => ({ ...visit, selectedLabId: isLabId(labId) ? labId : undefined }));
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
  const [scheduledVisits, setScheduledVisits] = useState<ScheduledVisits>(loadScheduled);

  useEffect(() => {
    saveScheduled(scheduledVisits);
  }, [scheduledVisits]);

  const onToggleRow = useCallback(
    (visitId: string, loincs: string[]) => setScheduledVisits((s) => toggleRow(s, visitId, loincs)),
    []
  );
  const onToggleIndex = useCallback((visitId: string, key: string) => setScheduledVisits((s) => toggleIndex(s, visitId, key)), []);
  const onSetMonth = useCallback(
    (visitId: string, month: string | undefined) => setScheduledVisits((s) => setScheduleMonth(s, visitId, month)),
    []
  );
  const onSelectLab = useCallback(
    (visitId: string, labId: string | undefined) => setScheduledVisits((s) => setSelectedLab(s, visitId, labId)),
    []
  );
  const onAddVisit = useCallback(() => setScheduledVisits((s) => addVisit(s, newRowId())), []);
  const onRemoveVisit = useCallback((visitId: string) => setScheduledVisits((s) => removeVisit(s, visitId)), []);
  const onReload = useCallback(() => setScheduledVisits(loadScheduled()), []);

  return {
    scheduledVisits,
    onToggleRow,
    onToggleIndex,
    onSetMonth,
    onSelectLab,
    onAddVisit,
    onRemoveVisit,
    onReload,
  };
}
