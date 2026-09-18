import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useScheduled } from '../../hooks/useScheduled';
import { sortVisitsByMonth, type ScheduledVisit } from '../../data/storage/scheduledVisits';
import type { IndexScheduling, RowScheduling } from './scheduling';

export type SchedulingApi = {
  /** Sorted once for every consumer, so `#plan` tabs and Scheduled columns never disagree on visit order. */
  sortedVisits: ScheduledVisit[];
  /** One entry per visit, in `sortedVisits` order. */
  rowSchedulings: RowScheduling[];
  indexSchedulings: IndexScheduling[];
  onAddVisit: () => void;
  onRemoveVisit: (visitId: string) => void;
  onSetMonth: (visitId: string, month: string | undefined) => void;
  onSelectLab: (visitId: string, labId: string | undefined) => void;
};

const SchedulingContext = createContext<SchedulingApi | null>(null);

/** One scheduling state for the whole shell, since Panel Detail remounts per panel. */
export function useSchedulingState(): { scheduling: SchedulingApi; reload: () => void } {
  const { scheduledVisits, onToggleRow, onToggleIndex, onSetMonth, onSelectLab, onAddVisit, onRemoveVisit, onReload } =
    useScheduled();
  const sortedVisits = useMemo(() => sortVisitsByMonth(scheduledVisits.visits), [scheduledVisits.visits]);

  const rowSchedulings: RowScheduling[] = sortedVisits.map((visit) => ({
    scheduled: visit,
    onToggle: (loincs) => onToggleRow(visit.id, loincs),
    onSetMonth: (month) => onSetMonth(visit.id, month),
    onRemove: () => onRemoveVisit(visit.id),
  }));
  const indexSchedulings: IndexScheduling[] = sortedVisits.map((visit) => ({
    scheduled: visit,
    onToggle: (key) => onToggleIndex(visit.id, key),
    onSetMonth: (month) => onSetMonth(visit.id, month),
    onRemove: () => onRemoveVisit(visit.id),
  }));

  return {
    scheduling: { sortedVisits, rowSchedulings, indexSchedulings, onAddVisit, onRemoveVisit, onSetMonth, onSelectLab },
    reload: onReload,
  };
}

export function SchedulingProvider({ value, children }: Readonly<{ value: SchedulingApi; children: ReactNode }>) {
  return <SchedulingContext.Provider value={value}>{children}</SchedulingContext.Provider>;
}

export function useSchedulingContext(): SchedulingApi {
  const api = useContext(SchedulingContext);
  if (!api) throw new Error('useSchedulingContext needs a SchedulingProvider above it');
  return api;
}
