import { useEffect, useRef, useState } from 'react';
import { useMedications, type MedicationRow } from '../../data/medications';
import { newRowId } from '../../data/ids';
import { MONTH_LABELS, monthKey } from '../../data/months';
import { Clock, TrendingUp } from 'lucide-react';
import { PillIcon } from './customIcons';
import { PageHeader } from './PageHeader';
import { Button, CARD_TABLE_TD, CARD_TABLE_TH, Card, EmptyState, FIELD_INPUT, TABLE, TABLE_CARD } from '../primitives';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';

const NAME_COL_WIDTH = 260;
const MONTH_COL_WIDTH = 32;
const YEAR_EDGE = `1px solid ${COLOR.borderMuted}`;
const BAR_FILL = `color-mix(in srgb, ${COLOR.brandTeal} 38%, ${COLOR.surface})`;
const BAR_INSET = 3;
const BAR_HEIGHT = 16;
// Same right-edge cut used by the mobile results-table reveal (index.css's `.mc-col-cut`), reused here so a
// frozen pane reads the same way everywhere in the app.
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

function monthTh(monthIndex: number, isLastColumn = false) {
  return {
    ...th,
    textAlign: 'center',
    padding: '4px 0 8px',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.04em',
    borderLeft: monthEdge(monthIndex),
    // Closes the table's right edge with the same line used at every other year boundary --
    // otherwise only the left side of each year block is ever drawn, and the last column's
    // right edge is left visually open.
    borderRight: isLastColumn ? YEAR_EDGE : 'none',
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

function monthTd(monthIndex: number, last: boolean, isLastColumn = false) {
  return {
    position: 'relative',
    padding: 0,
    height: 34,
    borderBottom: last ? 'none' : `1px solid ${COLOR.borderSubtle}`,
    borderLeft: monthEdge(monthIndex),
    borderRight: isLastColumn ? YEAR_EDGE : 'none',
  } as const;
}

/** A soft rounded bar; neighbouring marked months in the same year join into one, rounded only at the run's ends. */
function MonthBar({ joinsPrevious, joinsNext }: Readonly<{ joinsPrevious: boolean; joinsNext: boolean }>) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        // `top`/`bottom: 0` with `margin: auto 0` centers the bar in the cell's actual height -- whatever the
        // row ends up needing -- rather than assuming a row height to derive a fixed inset from.
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
 * `Compound` carries no id of its own, and its name/dose are edited in place, so neither the array
 * index nor the compound's own fields make a stable React key. `compoundKeys` mints one synthetic
 * key per compound slot instead: this tops up a row's key array whenever its `compounds` array has
 * grown past it -- covers initial load, import/restore and adding a compound alike, since every one
 * of those only ever appends -- while removal (the one case that doesn't) splices the exact removed
 * slot out in the click handler itself, so a key always tracks the compound it was minted for rather
 * than a position. Called during render rather than an effect, following React's supported "adjust
 * state while rendering" pattern, so a freshly added compound's key exists on the very render that
 * needs it instead of a tick later.
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

  // Initial scroll only: bring the current year's columns into view on first
  // paint, scrolling every earlier year out of sight behind the sticky
  // Medication column. A manual scroll afterward is left alone -- this never
  // re-runs, and years/rows are read fresh from the ref's own scroll width,
  // not tracked as effect dependencies.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const currentYear = new Date().getFullYear();
    const yearIndex = years.indexOf(currentYear);
    if (yearIndex <= 0) return;
    // Month columns already flow after the sticky Medication column in the table's own
    // content, so scrollLeft is measured from the start of the year columns, not from the
    // table's left edge -- adding NAME_COL_WIDTH here double-counted it and overshot into
    // the target year itself instead of landing on its January.
    const target = yearIndex * MONTH_COL_WIDTH * 12;
    // When the current year is the last one (the common case), the table may not have
    // enough width to its right to fill the container once scrolled this far, so the
    // browser silently clamps scrollLeft short -- which is what actually produced the
    // under-shoot, leaving the previous year's tail months in view. Pad the container so
    // the full target is reachable instead of merely the content that happens to exist.
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
                // `border-collapse: collapse` (the shared TABLE default) makes browsers paint cell
                // backgrounds/borders through the table's own collapsed-border algorithm instead of normal
                // z-index stacking, so a sticky cell's box-shadow stops painting over a scrolled-under sibling
                // once the two overlap. `.mc-col-cut`'s sticky shadow (index.css) never hits this: those tables
                // rely on the browser default of `separate`. Match that here instead of `collapse`.
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
                      <th key={`${year}-${m}`} scope="col" style={monthTh(i, yi === years.length - 1 && i === 11)}>
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
                  // Chronological, not scoped to a year's own 12 columns: December of one year and
                  // January of the next are adjacent calendar months, so a run marked across that
                  // boundary still joins into one bar instead of resetting at each year's column group.
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
                            {/* Always rendered, even with nothing to show: a reserved second line keeps every
                                row's Medication cell -- and so every row -- the same height, whether or not
                                this medication has compounds. */}
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
                          if (!editing) {
                            return (
                              <td key={key} style={monthTd(i, last, isLastColumn)} title={marked ? monthLabel(row, year, i) : undefined}>
                                {bar}
                              </td>
                            );
                          }
                          const toggle = () => onToggleMonth(row.id, key);
                          return (
                            <td key={key} style={monthTd(i, last, isLastColumn)}>
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
