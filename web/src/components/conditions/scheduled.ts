import { useCallback, useEffect, useState } from 'react';
import { MARKER_LOINC } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import { LOINC_TO_MARKER } from './markers';

// Which observations (by LOINC) and computed indices (by key) are marked for
// the next draw -- one global list across every panel, persisted so it
// survives a refresh.
export const SCHEDULED_KEY = 'bloodtests_scheduled_v1';
export type Scheduled = { loincs: string[]; indices: string[] };
export const EMPTY_SCHEDULED: Scheduled = { loincs: [], indices: [] };

/** The Scheduled column's wiring, handed to every table that renders one. */
export type RowScheduling = { scheduled: Scheduled; onToggle: (loincs: string[]) => void };
export type IndexScheduling = { scheduled: Scheduled; onToggle: (key: string) => void };

export function loadScheduled(): Scheduled {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Scheduled>;
      return {
        loincs: Array.isArray(parsed.loincs) ? parsed.loincs.filter((x): x is string => typeof x === 'string') : [],
        indices: Array.isArray(parsed.indices) ? parsed.indices.filter((x): x is string => typeof x === 'string') : [],
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
  return Array.from(new Set(def?.needs.flatMap((short) => MARKER_LOINC[short] ?? []) ?? []));
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
    def.needs.every((short) => (MARKER_LOINC[short] ?? []).some((loinc) => loincs.includes(loinc)))
  ).map((def) => def.key);
}

/** Toggling an observation re-derives every index from its inputs. */
export function toggleRow(scheduled: Scheduled, loincs: string[]): Scheduled {
  const all = withSiblings(loincs);
  const next = isRowScheduled(scheduled, all)
    ? scheduled.loincs.filter((loinc) => !all.includes(loinc))
    : union(scheduled.loincs, all);
  return { loincs: next, indices: deriveIndices(next) };
}

/** Scheduling an index also schedules its inputs; unscheduling leaves them alone. */
export function toggleIndex(scheduled: Scheduled, key: string): Scheduled {
  if (isIndexScheduled(scheduled, key)) {
    return { ...scheduled, indices: scheduled.indices.filter((k) => k !== key) };
  }
  return {
    loincs: union(scheduled.loincs, indexInputLoincs(key)),
    indices: [...scheduled.indices, key],
  };
}

export function useScheduled() {
  const [scheduled, setScheduled] = useState<Scheduled>(loadScheduled);

  useEffect(() => {
    saveScheduled(scheduled);
  }, [scheduled]);

  const onToggleRow = useCallback((loincs: string[]) => setScheduled((s) => toggleRow(s, loincs)), []);
  const onToggleIndex = useCallback((key: string) => setScheduled((s) => toggleIndex(s, key)), []);

  return { scheduled, onToggleRow, onToggleIndex };
}
