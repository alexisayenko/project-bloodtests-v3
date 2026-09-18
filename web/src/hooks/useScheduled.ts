import { useCallback, useEffect, useState } from 'react';
import { newRowId } from '../data/ids';
import {
  addVisit,
  loadScheduled,
  removeVisit,
  saveScheduled,
  setScheduleMonth,
  setSelectedLab,
  toggleIndex,
  toggleRow,
  type ScheduledVisits,
} from '../data/storage/scheduledVisits';

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
