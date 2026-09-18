import { useEffect, useRef, useState } from 'react';
import { useMedications } from '../../hooks/useMedications';
import type { MedicationRow } from '../../data/storage/medications';
import { newRowId } from '../../data/ids';
import { MONTH_LABELS, monthKey } from '../../data/months';
import { Clock, TrendingUp } from 'lucide-react';
import { PillIcon } from './customIcons';
import { PageHeader } from './PageHeader';
import { Button, CARD_TABLE_TD, CARD_TABLE_TH, Card, EmptyState, FIELD_INPUT, TABLE, TABLE_CARD } from '../primitives';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';

// Column zebra by continuous index across years, so the stripe pattern does not jump at year boundaries.
const COLUMN_STRIPE = COLOR.surfaceMuted;

const NAME_COL_WIDTH = 260;
const MONTH_COL_WIDTH = 32;
const YEAR_EDGE = `1px solid ${COLOR.borderMuted}`;
const BAR_FILL = `color-mix(in srgb, ${COLOR.brandTeal} 38%, ${COLOR.surface})`;
const BAR_INSET = 3;
const BAR_HEIGHT = 16;
// Same `.mc-col-cut` edge the results tables' frozen column uses.
const STICKY_EDGE_SHADOW = '2px 0 5px rgba(0, 0, 0, 0.14)';

const th = { ...CARD_TABLE_TH, verticalAlign: 'bottom' } as const;
const nameTh = { ...th, position: 'sticky', left: 0, zIndex: 1, boxShadow: STICKY_EDGE_SHADOW } as const;
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
  return { ...cell, position: 'sticky', left: 0, zIndex: 1, background: COLOR.surfaceCard, boxShadow: STICKY_EDGE_SHADOW } as const;
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

function monthTh(monthIndex: number, columnIndex: number, isLastColumn = false) {
  return {
    ...th,
    textAlign: 'center',
    padding: '4px 0 8px',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.04em',
    borderLeft: monthEdge(monthIndex),
    // Year edges are left borders only, so the last column closes the table's right edge itself.
    borderRight: isLastColumn ? YEAR_EDGE : 'none',
    background: columnIndex % 2 === 1 ? COLUMN_STRIPE : 'transparent',
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

function monthTd(monthIndex: number, columnIndex: number, last: boolean, isLastColumn = false) {
  return {
    position: 'relative',
    padding: 0,
    height: 34,
    borderBottom: last ? 'none' : `1px solid ${COLOR.borderSubtle}`,
    borderLeft: monthEdge(monthIndex),
    borderRight: isLastColumn ? YEAR_EDGE : 'none',
    background: columnIndex % 2 === 1 ? COLUMN_STRIPE : 'transparent',
  } as const;
}

/** A soft rounded bar; neighbouring marked months in the same year join into one, rounded only at the run's ends. */
function MonthBar({ joinsPrevious, joinsNext }: Readonly<{ joinsPrevious: boolean; joinsNext: boolean }>) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        // `top`/`bottom: 0` with `margin: auto 0` centers the bar in whatever height the row ends up with.
        top: 0,
        bottom: 0,
        margin: 'auto 0',
        height: BAR_HEIGHT,
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

/**
 * `Compound` has no id and is edited in place, so neither index nor fields make a stable React key;
 * synthetic keys are minted per slot here (appends only; removal splices in its handler), during
 * render so a new compound's key exists on the render that needs it.
 */
function padCompoundKeys(
  keys: Readonly<Record<string, readonly string[]>>,
  rows: readonly MedicationRow[]
): Record<string, readonly string[]> | null {
  let next: Record<string, readonly string[]> | undefined;
  for (const row of rows) {
    const existing = keys[row.id] ?? [];
    if (existing.length < row.compounds.length) {
      const padded = [...existing];
      while (padded.length < row.compounds.length) padded.push(newRowId());
      next = { ...(next ?? keys), [row.id]: padded };
    }
  }
  return next ?? null;
}

/** Splices out the removed compound's synthetic key so `compoundKeys` never drifts out of sync with `compounds`. */
function withCompoundKeyRemoved(
  keys: Readonly<Record<string, readonly string[]>>,
  rowId: string,
  index: number
): Record<string, readonly string[]> {
  return { ...keys, [rowId]: (keys[rowId] ?? []).filter((_, idx) => idx !== index) };
}

export function MedicationsView() {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { years, rows } = medications;

  const [compoundKeys, setCompoundKeys] = useState<Record<string, readonly string[]>>({});
  const paddedCompoundKeys = padCompoundKeys(compoundKeys, rows);
  const effectiveCompoundKeys = paddedCompoundKeys ?? compoundKeys;
  if (paddedCompoundKeys) {
    setCompoundKeys(paddedCompoundKeys);
  }

  useEffect(() => {
    if (focusId) nameInputs.current.get(focusId)?.focus();
  }, [focusId]);

  // Initial scroll only: the current year's January lands right after the sticky column; never re-runs.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const currentYear = new Date().getFullYear();
    const yearIndex = years.indexOf(currentYear);
    if (yearIndex <= 0) return;
    // scrollLeft is measured from the start of the month columns, so NAME_COL_WIDTH must not be added.
    const target = yearIndex * MONTH_COL_WIDTH * 12;
    // The browser clamps scrollLeft to the content that exists, so pad the container until the target is reachable.
    const shortfall = target - (el.scrollWidth - el.clientWidth);
    if (shortfall > 0) el.style.paddingRight = `${shortfall}px`;
    el.scrollLeft = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial scroll position only, deliberately not re-run on data changes
  }, []);

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
      </div>
      {!editing && rows.length === 0 ? (
        <EmptyState>No medications recorded yet — press Edit to add the first one.</EmptyState>
      ) : (
        <Card style={{ ...TABLE_CARD, width: 'fit-content', maxWidth: '100%' }}>
          <div ref={scrollRef} style={{ overflowX: 'auto' }}>
            <table
              style={{
                ...TABLE,
                // `collapse` would stop the sticky cell's box-shadow painting over a scrolled-under sibling.
                borderCollapse: 'separate',
                borderSpacing: 0,
                tableLayout: 'fixed',
                width: NAME_COL_WIDTH + MONTH_COL_WIDTH * 12 * years.length,
              }}
            >
              <colgroup>
                <col style={{ width: NAME_COL_WIDTH }} />
                {years.flatMap((year) => MONTH_LABELS.map((m) => <col key={`${year}-${m}`} style={{ width: MONTH_COL_WIDTH }} />))}
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2} scope="col" style={nameTh}>
                    Medication
                  </th>
                  {years.map((year, yi) => (
                    <th
                      key={year}
                      colSpan={12}
                      scope="colgroup"
                      style={yi === years.length - 1 ? { ...yearTh, borderRight: YEAR_EDGE } : yearTh}
                    >
                      {year}
                    </th>
                  ))}
                </tr>
                <tr>
                  {years.flatMap((year, yi) =>
                    MONTH_LABELS.map((m, i) => (
                      <th key={`${year}-${m}`} scope="col" style={monthTh(i, yi * 12 + i, yi === years.length - 1 && i === 11)}>
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
                  // Chronological across years, so December and the next January join into one bar.
                  const isMarked = (year: number, monthIndex: number) => {
                    let rolloverYear = year;
                    if (monthIndex < 0) rolloverYear = year - 1;
                    else if (monthIndex > 11) rolloverYear = year + 1;
                    const rolloverMonth = (monthIndex + 12) % 12;
                    return row.months.includes(monthKey(rolloverYear, rolloverMonth));
                  };
                  const rowCompoundKeys = effectiveCompoundKeys[row.id] ?? [];
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
                              <div key={rowCompoundKeys[i]} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 26 }}>
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
                                  onClick={() => {
                                    setCompoundKeys((prev) => withCompoundKeyRemoved(prev, row.id, i));
                                    onRemoveCompound(row.id, i);
                                  }}
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
                            <input
                              aria-label={`Notes for ${row.brand.trim() || 'unnamed medication'}`}
                              placeholder="Notes (timing, frequency, ...)"
                              value={row.notes}
                              onChange={(e) => onUpdateRow(row.id, { notes: e.target.value })}
                              style={compoundInput}
                            />
                          </div>
                        ) : (
                          <>
                            <span
                              style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, color: COLOR.navy }}
                            >
                              {row.brand}
                            </span>
                            {/* Always rendered, so every row keeps the same height with or without compounds. */}
                            <span
                              style={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: 11,
                                color: COLOR.textMuted,
                              }}
                            >
                              {row.compounds.length > 0 ? compoundsLine(row) : ' '}
                            </span>
                          </>
                        )}
                      </td>
                      {years.flatMap((year, yi) =>
                        MONTH_LABELS.map((_label, i) => {
                          const key = monthKey(year, i);
                          const marked = row.months.includes(key);
                          const bar = marked && <MonthBar joinsPrevious={isMarked(year, i - 1)} joinsNext={isMarked(year, i + 1)} />;
                          const isLastColumn = yi === years.length - 1 && i === 11;
                          const columnIndex = yi * 12 + i;
                          if (!editing) {
                            return (
                              <td
                                key={key}
                                style={monthTd(i, columnIndex, last, isLastColumn)}
                                title={marked ? monthLabel(row, year, i) : undefined}
                              >
                                {bar}
                              </td>
                            );
                          }
                          const toggle = () => onToggleMonth(row.id, key);
                          return (
                            <td key={key} style={monthTd(i, columnIndex, last, isLastColumn)}>
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
