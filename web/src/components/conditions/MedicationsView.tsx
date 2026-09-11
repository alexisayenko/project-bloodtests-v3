import { useEffect, useRef, useState } from 'react';
import { MONTH_LABELS, monthKey, useMedications, type MedicationRow } from '../../data/medications';
import { Pill, Clock, TrendingUp } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { Button, EmptyState, FIELD_INPUT, TABLE, TABLE_TD, TABLE_TH } from '../primitives';
import { COLOR } from '../../styles/tokens';

const NAME_COL_WIDTH = 220;
const DOSAGE_COL_WIDTH = 160;
const MONTH_COL_WIDTH = 32;

const th = { ...TABLE_TH, verticalAlign: 'bottom' } as const;
const yearTh = {
  ...th,
  textAlign: 'center',
  padding: '6px 0',
  borderBottom: `1px solid ${COLOR.borderMuted}`,
  borderLeft: `1px solid ${COLOR.borderMuted}`,
} as const;
const td = { ...TABLE_TD, padding: '6px 12px' } as const;
const input = { ...FIELD_INPUT, width: '100%', boxSizing: 'border-box', padding: '4px 8px' } as const;
const removeButton = { padding: '0 7px', border: `1px solid ${COLOR.border}`, color: COLOR.textMuted, lineHeight: '18px' } as const;

// The first month of each year carries the stronger edge, so years read as blocks.
function monthEdge(monthIndex: number) {
  return `1px solid ${monthIndex === 0 ? COLOR.borderMuted : COLOR.borderSubtle}`;
}

function monthTh(monthIndex: number) {
  return { ...th, textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 500, color: COLOR.textMuted, borderLeft: monthEdge(monthIndex) } as const;
}

const monthCheckbox = {
  appearance: 'none',
  display: 'block',
  boxSizing: 'border-box',
  width: '100%',
  height: '100%',
  minHeight: 34,
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
} as const;

function monthTd(monthIndex: number, marked: boolean) {
  return {
    padding: 0,
    height: 34,
    borderBottom: `1px solid ${COLOR.borderSubtle}`,
    borderLeft: monthEdge(monthIndex),
    background: marked ? COLOR.accent : undefined,
  } as const;
}

function monthLabel(row: MedicationRow, year: number, monthIndex: number): string {
  return `${row.name.trim() || 'Unnamed medication'}, ${MONTH_LABELS[monthIndex]} ${year}`;
}

export function MedicationsView() {
  const { medications, onAddRow, onUpdateRow, onRemoveRow, onToggleMonth, onAddPastYear, onDropUnnamed } = useMedications();
  const [editing, setEditing] = useState(false);
  const [focusId, setFocusId] = useState<string>();
  const nameInputs = useRef(new Map<string, HTMLInputElement>());
  const { years, rows } = medications;

  useEffect(() => {
    if (focusId) nameInputs.current.get(focusId)?.focus();
  }, [focusId]);

  const toggleEditing = () => {
    if (editing) onDropUnnamed();
    setEditing(!editing);
  };

  return (
    <>
      <PageHeader
        overline="Treatment & Supplement History"
        titlePrimary="Active"
        titleAccent="Medications"
        description={[
          'Track active prescriptions, dietary supplements, and dosage adjustments over time.',
          'Correlate medication changes with biomarker movements across your timeline.',
        ]}
        pillars={[
          { icon: Pill, line1: 'Dosage & intake', line2: 'monthly log' },
          { icon: Clock, line1: 'Chronological', line2: 'regimen history' },
          { icon: TrendingUp, line1: 'Biomarker shift', line2: 'correlation' },
        ]}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Button size="sm" onClick={toggleEditing}>
          {editing ? 'Done' : 'Edit'}
        </Button>
        {editing && (
          <>
            <Button size="sm" onClick={() => setFocusId(onAddRow())}>
              Add medication
            </Button>
            <Button size="sm" onClick={onAddPastYear}>
              Add past year
            </Button>
          </>
        )}
      </div>
      {!editing && rows.length === 0 ? (
        <EmptyState>No medications recorded yet — press Edit to add the first one.</EmptyState>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              ...TABLE,
              tableLayout: 'fixed',
              width: NAME_COL_WIDTH + DOSAGE_COL_WIDTH + MONTH_COL_WIDTH * 12 * years.length,
            }}
          >
            <colgroup>
              <col style={{ width: NAME_COL_WIDTH }} />
              <col style={{ width: DOSAGE_COL_WIDTH }} />
              {years.flatMap((year) => MONTH_LABELS.map((m) => <col key={`${year}-${m}`} style={{ width: MONTH_COL_WIDTH }} />))}
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2} scope="col" style={th}>
                  Medication
                </th>
                <th rowSpan={2} scope="col" style={th}>
                  Dosage
                </th>
                {years.map((year) => (
                  <th key={year} colSpan={12} scope="colgroup" style={yearTh}>
                    {year}
                  </th>
                ))}
              </tr>
              <tr>
                {years.flatMap((year) =>
                  MONTH_LABELS.map((m, i) => (
                    <th key={`${year}-${m}`} scope="col" style={monthTh(i)}>
                      {m}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={td}>
                    {editing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Button
                          size="sm"
                          aria-label={`Remove ${row.name.trim() || 'unnamed medication'}`}
                          onClick={() => onRemoveRow(row.id)}
                          style={removeButton}
                        >
                          ×
                        </Button>
                        <input
                          ref={(el) => {
                            if (el) nameInputs.current.set(row.id, el);
                            else nameInputs.current.delete(row.id);
                          }}
                          aria-label="Medication name"
                          value={row.name}
                          onChange={(e) => onUpdateRow(row.id, { name: e.target.value })}
                          style={input}
                        />
                      </div>
                    ) : (
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                    )}
                  </td>
                  <td style={td}>
                    {editing ? (
                      <input
                        aria-label={`Dosage of ${row.name.trim() || 'unnamed medication'}`}
                        value={row.dosage}
                        onChange={(e) => onUpdateRow(row.id, { dosage: e.target.value })}
                        style={input}
                      />
                    ) : (
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.dosage}</span>
                    )}
                  </td>
                  {years.flatMap((year) =>
                    MONTH_LABELS.map((_label, i) => {
                      const key = monthKey(year, i);
                      const marked = row.months.includes(key);
                      if (!editing) {
                        return <td key={key} style={monthTd(i, marked)} title={marked ? monthLabel(row, year, i) : undefined} />;
                      }
                      const toggle = () => onToggleMonth(row.id, key);
                      return (
                        <td key={key} style={monthTd(i, marked)}>
                          <input
                            type="checkbox"
                            checked={marked}
                            aria-label={monthLabel(row, year, i)}
                            onChange={toggle}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                toggle();
                              }
                            }}
                            style={monthCheckbox}
                          />
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
