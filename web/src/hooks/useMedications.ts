import { useCallback, useEffect, useState } from 'react';
import { newRowId } from '../data/ids';
import {
  addCompound,
  addPastYear,
  addRow,
  dropUnnamed,
  loadMedications,
  removeCompound,
  removeRow,
  saveMedications,
  toggleMonth,
  updateCompound,
  updateRow,
  type Compound,
  type MedicationRow,
  type Medications,
} from '../data/storage/medications';

export function useMedications() {
  const [medications, setMedications] = useState<Medications>(() => loadMedications());

  useEffect(() => {
    saveMedications(medications);
  }, [medications]);

  const onAddRow = useCallback(() => {
    const id = newRowId();
    setMedications((m) => addRow(m, id));
    return id;
  }, []);
  const onUpdateRow = useCallback(
    (id: string, patch: Partial<Pick<MedicationRow, 'brand' | 'notes'>>) => setMedications((m) => updateRow(m, id, patch)),
    []
  );
  const onRemoveRow = useCallback((id: string) => setMedications((m) => removeRow(m, id)), []);
  const onAddCompound = useCallback((id: string) => setMedications((m) => addCompound(m, id)), []);
  const onUpdateCompound = useCallback(
    (id: string, index: number, patch: Partial<Compound>) => setMedications((m) => updateCompound(m, id, index, patch)),
    []
  );
  const onRemoveCompound = useCallback((id: string, index: number) => setMedications((m) => removeCompound(m, id, index)), []);
  const onToggleMonth = useCallback((id: string, month: string) => setMedications((m) => toggleMonth(m, id, month)), []);
  const onAddPastYear = useCallback(() => setMedications(addPastYear), []);
  const onDropUnnamed = useCallback(() => setMedications(dropUnnamed), []);

  return {
    medications,
    onAddRow,
    onUpdateRow,
    onRemoveRow,
    onAddCompound,
    onUpdateCompound,
    onRemoveCompound,
    onToggleMonth,
    onAddPastYear,
    onDropUnnamed,
  };
}
