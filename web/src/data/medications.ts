import { useCallback, useEffect, useState } from 'react';
import { newRowId } from './ids';

export const MEDICATIONS_KEY = 'bloodtests_medications_v1';

export type MedicationRow = { id: string; name: string; dosage: string; months: string[] };
export type Medications = { years: number[]; rows: MedicationRow[] };

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999;
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

// A year is shown if it was added, is the current one, or carries a mark -- so
// a stored mark can never sit in a year the table does not render.
function withYears(years: number[], rows: MedicationRow[], currentYear: number): number[] {
  const marked = rows.flatMap((row) => row.months.map((m) => Number(m.slice(0, 4))));
  return Array.from(new Set([...years, ...marked, currentYear])).sort((a, b) => a - b);
}

export function emptyMedications(currentYear: number): Medications {
  return { years: [currentYear], rows: [] };
}

export function addRow(meds: Medications, id: string): Medications {
  return { ...meds, rows: [...meds.rows, { id, name: '', dosage: '', months: [] }] };
}

export function updateRow(meds: Medications, id: string, patch: Partial<Pick<MedicationRow, 'name' | 'dosage'>>): Medications {
  return { ...meds, rows: meds.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) };
}

export function removeRow(meds: Medications, id: string): Medications {
  return { ...meds, rows: meds.rows.filter((row) => row.id !== id) };
}

export function toggleMonth(meds: Medications, id: string, month: string): Medications {
  if (!MONTH_RE.test(month)) return meds;
  return {
    ...meds,
    rows: meds.rows.map((row) => {
      if (row.id !== id) return row;
      const months = row.months.includes(month)
        ? row.months.filter((m) => m !== month)
        : [...row.months, month].sort((a, b) => a.localeCompare(b));
      return { ...row, months };
    }),
  };
}

export function addPastYear(meds: Medications): Medications {
  return { ...meds, years: [Math.min(...meds.years) - 1, ...meds.years] };
}

export function dropUnnamed(meds: Medications): Medications {
  return { ...meds, rows: meds.rows.filter((row) => row.name.trim() !== '') };
}

function parseRow(value: unknown): MedicationRow | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id === '' || typeof row.name !== 'string') return undefined;
  const months = Array.isArray(row.months)
    ? row.months.filter((m): m is string => typeof m === 'string' && MONTH_RE.test(m))
    : [];
  return {
    id: row.id,
    name: row.name,
    dosage: typeof row.dosage === 'string' ? row.dosage : '',
    months: Array.from(new Set(months)).sort((a, b) => a.localeCompare(b)),
  };
}

/** Whether a payload from outside (a backup) has the stored shape at all, before parseMedications forgives its rows. */
export function isMedicationsShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const meds = value as Record<string, unknown>;
  return Array.isArray(meds.years) && Array.isArray(meds.rows);
}

/** A stored payload read back; anything missing or malformed reads as empty, and an unnamed row is dropped. */
export function parseMedications(raw: string | null, currentYear: number): Medications {
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<keyof Medications, unknown>>;
      const rows = Array.isArray(parsed.rows) ? parsed.rows.map(parseRow).filter((r): r is MedicationRow => !!r) : [];
      const years = Array.isArray(parsed.years) ? parsed.years.filter(isYear) : [];
      return dropUnnamed({ years: withYears(years, rows, currentYear), rows });
    }
  } catch {
    // corrupt local storage -- start empty
  }
  return emptyMedications(currentYear);
}

export function loadMedications(currentYear = new Date().getFullYear()): Medications {
  try {
    return parseMedications(localStorage.getItem(MEDICATIONS_KEY), currentYear);
  } catch {
    return emptyMedications(currentYear);
  }
}

export function saveMedications(meds: Medications): void {
  try {
    localStorage.setItem(MEDICATIONS_KEY, JSON.stringify(meds));
  } catch {
    // storage unavailable -- history just won't persist
  }
}

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
    (id: string, patch: Partial<Pick<MedicationRow, 'name' | 'dosage'>>) => setMedications((m) => updateRow(m, id, patch)),
    []
  );
  const onRemoveRow = useCallback((id: string) => setMedications((m) => removeRow(m, id)), []);
  const onToggleMonth = useCallback((id: string, month: string) => setMedications((m) => toggleMonth(m, id, month)), []);
  const onAddPastYear = useCallback(() => setMedications(addPastYear), []);
  const onDropUnnamed = useCallback(() => setMedications(dropUnnamed), []);

  return { medications, onAddRow, onUpdateRow, onRemoveRow, onToggleMonth, onAddPastYear, onDropUnnamed };
}
