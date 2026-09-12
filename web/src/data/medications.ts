import { useCallback, useEffect, useState } from 'react';
import { newRowId } from './ids';
import { isMonthKey } from './months';

export const MEDICATIONS_KEY = 'bloodtests_medications_v1';

export type Compound = { name: string; dose: string };
export type MedicationRow = { id: string; brand: string; compounds: Compound[]; notes: string; months: string[] };
export type Medications = { years: number[]; rows: MedicationRow[] };

function isYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999;
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
  return { ...meds, rows: [...meds.rows, { id, brand: '', compounds: [], notes: '', months: [] }] };
}

export function updateRow(meds: Medications, id: string, patch: Partial<Pick<MedicationRow, 'brand' | 'notes'>>): Medications {
  return { ...meds, rows: meds.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) };
}

export function removeRow(meds: Medications, id: string): Medications {
  return { ...meds, rows: meds.rows.filter((row) => row.id !== id) };
}

export function addCompound(meds: Medications, id: string): Medications {
  return {
    ...meds,
    rows: meds.rows.map((row) => (row.id === id ? { ...row, compounds: [...row.compounds, { name: '', dose: '' }] } : row)),
  };
}

export function updateCompound(meds: Medications, id: string, index: number, patch: Partial<Compound>): Medications {
  return {
    ...meds,
    rows: meds.rows.map((row) =>
      row.id === id ? { ...row, compounds: row.compounds.map((c, i) => (i === index ? { ...c, ...patch } : c)) } : row
    ),
  };
}

export function removeCompound(meds: Medications, id: string, index: number): Medications {
  return {
    ...meds,
    rows: meds.rows.map((row) => (row.id === id ? { ...row, compounds: row.compounds.filter((_, i) => i !== index) } : row)),
  };
}

export function toggleMonth(meds: Medications, id: string, month: string): Medications {
  if (!isMonthKey(month)) return meds;
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
  return { ...meds, rows: meds.rows.filter((row) => row.brand.trim() !== '') };
}

function parseCompound(value: unknown): Compound | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const c = value as Record<string, unknown>;
  return { name: typeof c.name === 'string' ? c.name : '', dose: typeof c.dose === 'string' ? c.dose : '' };
}

function parseCompounds(value: unknown): Compound[] {
  return Array.isArray(value) ? value.map(parseCompound).filter((c): c is Compound => !!c) : [];
}

function parseRow(value: unknown): MedicationRow | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id === '') return undefined;
  const months = Array.isArray(row.months) ? row.months.filter(isMonthKey) : [];
  const sortedMonths = Array.from(new Set(months)).sort((a, b) => a.localeCompare(b));

  if (typeof row.brand === 'string') {
    return {
      id: row.id,
      brand: row.brand,
      compounds: parseCompounds(row.compounds),
      notes: typeof row.notes === 'string' ? row.notes : '',
      months: sortedMonths,
    };
  }

  // Pre-redesign shape (name/dosage): migrated losslessly and as-is into brand/notes, with no
  // attempt to split a parenthetical compound note or align it against a "+"-separated dose --
  // that pairing is unreliable, so compounds start empty and the user can re-enter them by hand.
  if (typeof row.name === 'string') {
    return {
      id: row.id,
      brand: row.name,
      compounds: [],
      notes: typeof row.dosage === 'string' ? row.dosage : '',
      months: sortedMonths,
    };
  }

  return undefined;
}

/** Whether a payload from outside (a backup) has the stored shape at all, before parseMedications forgives its rows. */
export function isMedicationsShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const meds = value as Record<string, unknown>;
  return Array.isArray(meds.years) && Array.isArray(meds.rows);
}

/**
 * A stored payload read back; anything missing or malformed reads as empty, an unnamed row is
 * dropped, and a row still in the pre-redesign name/dosage shape is migrated transparently.
 */
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
