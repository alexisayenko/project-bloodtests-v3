import { useEffect, useRef, useState } from 'react';
import { MONTH_LABELS, monthKey, useMedications, type MedicationRow } from '../../data/medications';
import { Pill, Clock, TrendingUp } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { Button, CARD_TABLE_TD, CARD_TABLE_TH, Card, EmptyState, FIELD_INPUT, TABLE, TABLE_CARD } from '../primitives';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';

const NAME_COL_WIDTH = 220;
const DOSAGE_COL_WIDTH = 160;
const MONTH_COL_WIDTH = 32;
const YEAR_EDGE = `1px solid ${COLOR.borderMuted}`;
const BAR_FILL = `color-mix(in srgb, ${COLOR.brandTeal} 38%, ${COLOR.surface})`;
const BAR_INSET = 3;

const th = { ...CARD_TABLE_TH, verticalAlign: 'bottom' } as const;
const yearTh = {
  ...th,
  textAlign: 'center',
  padding: '8px 0 4px',
  borderBottom: 'none',
  borderLeft: YEAR_EDGE,
  color: COLOR.textSecondary,
} as const;
const td = { ...CARD_TABLE_TD, padding: '6px 12px' } as const;
const lastTd = { ...td, borderBottom: 'none' } as const;
const input = { ...FIELD_INPUT, width: '100%', boxSizing: 'border-box', padding: '4px 8px' } as const;
const removeButton = { padding: '0 7px', border: `1px solid ${COLOR.border}`, color: COLOR.textMuted, lineHeight: '18px' } as const;

// Only the first month of each year carries an edge, so years read as blocks and a run of months as one bar.
function monthEdge(monthIndex: number) {
  return monthIndex === 0 ? YEAR_EDGE : 'none';
}

function monthTh(monthIndex: number) {
  return {
    ...th,
    textAlign: 'center',
    padding: '4px 0 8px',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.04em',
    borderLeft: monthEdge(monthIndex),
  } as const;
}

const monthCheckbox = {
  appearance: 'none',
  position: 'relative',
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

function monthTd(monthIndex: number, last: boolean) {
  return {
    position: 'relative',
    padding: 0,
    height: 34,
    borderBottom: last ? 'none' : `1px solid ${COLOR.borderSubtle}`,
    borderLeft: monthEdge(monthIndex),
  } as const;
}

/** A soft rounded bar; neighbouring marked months in the same year join into one, rounded only at the run's ends. */
function MonthBar({ joinsPrevious, joinsNext }: Readonly<{ joinsPrevious: boolean; joinsNext: boolean }>) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 9,
        bottom: 9,
        left: joinsPrevious ? 0 : BAR_INSET,
        right: joinsNext ? 0 : BAR_INSET,
        background: BAR_FILL,
        borderTopLeftRadius: joinsPrevious ? 0 : RADIUS.pill,
        borderBottomLeftRadius: joinsPrevious ? 0 : RADIUS.pill,
        borderTopRightRadius: joinsNext ? 0 : RADIUS.pill,
        borderBottomRightRadius: joinsNext ? 0 : RADIUS.pill,
        pointerEvents: 'none',
      }}
    />
  );
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2], marginBottom: SPACE[4] }}>
        <Button size="sm" variant="primary" onClick={toggleEditing}>
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
        <Card style={{ ...TABLE_CARD, width: 'fit-content', maxWidth: '100%' }}>
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
                {rows.map((row, r) => {
                  const last = r === rows.length - 1;
                  const cell = last ? lastTd : td;
                  const isMarked = (year: number, monthIndex: number) =>
                    monthIndex >= 0 && monthIndex < 12 && row.months.includes(monthKey(year, monthIndex));
                  return (
                    <tr key={row.id}>
                      <td style={cell}>
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
                          <span
                            style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, color: COLOR.navy }}
                          >
                            {row.name}
                          </span>
                        )}
                      </td>
                      <td style={cell}>
                        {editing ? (
                          <input
                            aria-label={`Dosage of ${row.name.trim() || 'unnamed medication'}`}
                            value={row.dosage}
                            onChange={(e) => onUpdateRow(row.id, { dosage: e.target.value })}
                            style={input}
                          />
                        ) : (
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', color: COLOR.textSecondary }}>
                            {row.dosage}
                          </span>
                        )}
                      </td>
                      {years.flatMap((year) =>
                        MONTH_LABELS.map((_label, i) => {
                          const key = monthKey(year, i);
                          const marked = row.months.includes(key);
                          const bar = marked && <MonthBar joinsPrevious={isMarked(year, i - 1)} joinsNext={isMarked(year, i + 1)} />;
                          if (!editing) {
                            return (
                              <td key={key} style={monthTd(i, last)} title={marked ? monthLabel(row, year, i) : undefined}>
                                {bar}
                              </td>
                            );
                          }
                          const toggle = () => onToggleMonth(row.id, key);
                          return (
                            <td key={key} style={monthTd(i, last)}>
                              {bar}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
