import { useEffect, useRef, useState } from 'react';
import { useMedications, type MedicationRow } from '../../data/medications';
import { MONTH_LABELS, monthKey } from '../../data/months';
import { Clock, TrendingUp } from 'lucide-react';
import { PillIcon } from './customIcons';
import { PageHeader } from './PageHeader';
import { Button, CARD_TABLE_TD, CARD_TABLE_TH, Card, EmptyState, FIELD_INPUT, SwitchToggle, TABLE, TABLE_CARD } from '../primitives';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';

/** Shown in the Notes column in place of a truly blank cell -- the assumed default for a medication with no timing note. */
const NOTES_PLACEHOLDER = '1 tablet daily';

const NAME_COL_WIDTH = 260;
const DOSAGE_COL_WIDTH = 170;
const MONTH_COL_WIDTH = 32;
const YEAR_EDGE = `1px solid ${COLOR.borderMuted}`;
const BAR_FILL = `color-mix(in srgb, ${COLOR.brandTeal} 38%, ${COLOR.surface})`;
const BAR_INSET = 3;
// Same right-edge cut used by the mobile results-table reveal (index.css's `.mc-col-cut`), reused here so a
// frozen pane reads the same way everywhere in the app.
const STICKY_EDGE_SHADOW = '2px 0 5px rgba(0, 0, 0, 0.14)';

const th = { ...CARD_TABLE_TH, verticalAlign: 'bottom' } as const;
const nameTh = { ...th, position: 'sticky', left: 0, zIndex: 1 } as const;
const dosageTh = { ...th, position: 'sticky', left: NAME_COL_WIDTH, zIndex: 1, boxShadow: STICKY_EDGE_SHADOW } as const;
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

function nameCellStyle<T extends object>(cell: T) {
  return { ...cell, position: 'sticky', left: 0, zIndex: 1, background: COLOR.surfaceCard } as const;
}
function dosageCellStyle<T extends object>(cell: T) {
  return {
    ...cell,
    position: 'sticky',
    left: NAME_COL_WIDTH,
    zIndex: 1,
    background: COLOR.surfaceCard,
    boxShadow: STICKY_EDGE_SHADOW,
  } as const;
}
const input = { ...FIELD_INPUT, width: '100%', boxSizing: 'border-box', padding: '4px 8px' } as const;
const compoundInput = { ...input, padding: '3px 6px', fontSize: 12 } as const;
const removeButton = { padding: '0 7px', border: `1px solid ${COLOR.border}`, color: COLOR.textMuted, lineHeight: '18px' } as const;
const removeCompoundButton = { ...removeButton, padding: '0 5px', fontSize: 11, lineHeight: '16px' } as const;
const addCompoundButton = { padding: '2px 8px', fontSize: 11 } as const;

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
  return `${row.brand.trim() || 'Unnamed medication'}, ${MONTH_LABELS[monthIndex]} ${year}`;
}

/** The compounds subline shown under the brand name in view mode; empty when there is nothing to break out. */
function compoundsLine(row: MedicationRow): string {
  return row.compounds.map((c) => `${c.name} ${c.dose}`.trim()).join(', ');
}

export function MedicationsView({
  currentYearOnly,
  onCurrentYearOnlyChange,
}: Readonly<{ currentYearOnly: boolean; onCurrentYearOnlyChange: (next: boolean) => void }>) {
  const {
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
  } = useMedications();
  const [editing, setEditing] = useState(false);
  const [focusId, setFocusId] = useState<string>();
  const nameInputs = useRef(new Map<string, HTMLInputElement>());
  const { years: allYears, rows } = medications;
  const currentYear = new Date().getFullYear();
  const years = currentYearOnly ? allYears.filter((year) => year === currentYear) : allYears;

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
          { icon: PillIcon, line1: 'Dosage & intake', line2: 'monthly log' },
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
        <SwitchToggle label="Show only current year" pressed={currentYearOnly} onChange={onCurrentYearOnlyChange} />
      </div>
      {!editing && rows.length === 0 ? (
        <EmptyState>No medications recorded yet — press Edit to add the first one.</EmptyState>
      ) : (
        <Card style={{ ...TABLE_CARD, width: 'fit-content', maxWidth: '100%' }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                ...TABLE,
                // `border-collapse: collapse` (the shared TABLE default) makes browsers paint cell
                // backgrounds/borders through the table's own collapsed-border algorithm instead of normal
                // z-index stacking, so a sticky cell's box-shadow stops painting over a scrolled-under sibling
                // once the two overlap. `.mc-col-cut`'s sticky shadow (index.css) never hits this: those tables
                // rely on the browser default of `separate`. Match that here instead of `collapse`.
                borderCollapse: 'separate',
                borderSpacing: 0,
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
                  <th rowSpan={2} scope="col" style={nameTh}>
                    Medication
                  </th>
                  <th rowSpan={2} scope="col" style={dosageTh}>
                    Notes
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
                      <td style={nameCellStyle(cell)}>
                        {editing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Button
                                size="sm"
                                aria-label={`Remove ${row.brand.trim() || 'unnamed medication'}`}
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
                                aria-label="Medication brand name"
                                value={row.brand}
                                onChange={(e) => onUpdateRow(row.id, { brand: e.target.value })}
                                style={input}
                              />
                            </div>
                            {row.compounds.map((compound, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 26 }}>
                                <input
                                  aria-label={`Compound ${i + 1} name`}
                                  placeholder="Compound"
                                  value={compound.name}
                                  onChange={(e) => onUpdateCompound(row.id, i, { name: e.target.value })}
                                  style={{ ...compoundInput, flex: 2, minWidth: 0 }}
                                />
                                <input
                                  aria-label={`Compound ${i + 1} dose`}
                                  placeholder="Dose"
                                  value={compound.dose}
                                  onChange={(e) => onUpdateCompound(row.id, i, { dose: e.target.value })}
                                  style={{ ...compoundInput, flex: 1, minWidth: 0 }}
                                />
                                <Button
                                  size="xs"
                                  aria-label={`Remove compound ${i + 1}`}
                                  onClick={() => onRemoveCompound(row.id, i)}
                                  style={removeCompoundButton}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                            <div style={{ paddingLeft: 26 }}>
                              <Button size="xs" onClick={() => onAddCompound(row.id)} style={addCompoundButton}>
                                + Compound
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span
                              style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, color: COLOR.navy }}
                            >
                              {row.brand}
                            </span>
                            {row.compounds.length > 0 && (
                              <span
                                style={{
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontSize: 11,
                                  color: COLOR.textMuted,
                                }}
                              >
                                {compoundsLine(row)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td style={dosageCellStyle(cell)}>
                        {editing ? (
                          <input
                            aria-label={`Notes for ${row.brand.trim() || 'unnamed medication'}`}
                            value={row.notes}
                            onChange={(e) => onUpdateRow(row.id, { notes: e.target.value })}
                            style={input}
                          />
                        ) : row.notes.trim() !== '' ? (
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', color: COLOR.textSecondary }}>
                            {row.notes}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: COLOR.textMuted,
                              fontStyle: 'italic',
                            }}
                          >
                            {NOTES_PLACEHOLDER}
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
