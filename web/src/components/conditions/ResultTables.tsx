import { fmtNum, isOutOfRange } from '../../utils/format';
import { computeIndex, zone, type IndexDef } from '../../data/computedIndices';
import { testLoincs, type Observation } from './markers';
import {
  ZONE_BG,
  SELECTED_ZONE_BG,
  buildRowCells,
  formatMonthYear,
  pressable,
  cellBg,
  isCellArmed,
  type RowCell,
  type SelectedCell,
} from './ui';
import { hasReference, type ResultEntry } from './resultsLookup';
import { indexInputLoincs, isIndexScheduled, isRowScheduled, type IndexScheduling, type RowScheduling } from './scheduled';
import type { Result } from '../../types';

const DATE_COL_WIDTH = 96;
// Shared across observations and both indices tables so they line up as one block.
const LABEL_COL_WIDTH = 180;
// The Scheduled column sits after an empty spacer column so it reads as a
// separate block from the date grid while staying in the same table (exact
// row alignment for free).
const GAP_COL_WIDTH = 16;
const SCHEDULED_COL_WIDTH = 96;

// Fixed layout only kicks in with a non-auto table width; every column width
// then comes from the colgroup, so tables given the same dates share one grid
// whatever their content.
const table = { borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', width: '100%' } as const;

const th = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1.5px solid #1971c2',
  whiteSpace: 'nowrap',
} as const;
const td = { padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' } as const;
const labelTd = { ...td, whiteSpace: 'normal', overflowWrap: 'anywhere' } as const;
const gapCell = { padding: 0, border: 'none' } as const;
const scheduledTh = {
  ...th,
  textAlign: 'center',
  borderLeft: '1px solid #ddd',
  borderRight: '1px solid #ddd',
} as const;
const scheduledTd = {
  ...td,
  textAlign: 'center',
  borderLeft: '1px solid #ddd',
  borderRight: '1px solid #ddd',
  color: '#1971c2',
  fontWeight: 600,
  userSelect: 'none',
} as const;

function ColGroup({ dates, scheduling }: Readonly<{ dates: string[]; scheduling: boolean }>) {
  return (
    <colgroup>
      <col style={{ width: LABEL_COL_WIDTH }} />
      {dates.map((date) => (
        <col key={date} style={{ width: DATE_COL_WIDTH }} />
      ))}
      {scheduling && (
        <>
          <col style={{ width: GAP_COL_WIDTH }} />
          <col style={{ width: SCHEDULED_COL_WIDTH }} />
        </>
      )}
      {/* Trailing auto column soaks up the leftover width so the grid keeps its px widths. */}
      <col />
    </colgroup>
  );
}

function TableHead({ label, dates, scheduling }: Readonly<{ label: string; dates: string[]; scheduling: boolean }>) {
  return (
    <thead>
      <tr>
        <th style={th}>{label}</th>
        {dates.map((date) => (
          <th key={date} style={th}>
            {formatMonthYear(date)}
          </th>
        ))}
        {scheduling && (
          <>
            <th style={gapCell} />
            <th style={scheduledTh}>Scheduled</th>
          </>
        )}
      </tr>
    </thead>
  );
}

/** Single-click toggle marking a row for the next draw -- no arming step, unlike the value cells. */
function ScheduledCell({ checked, label, onToggle }: Readonly<{ checked: boolean; label: string; onToggle: () => void }>) {
  return (
    <>
      <td style={gapCell} />
      <td style={{ ...scheduledTd, position: 'relative' }} title={checked ? 'Scheduled -- click to unschedule' : 'Click to schedule'}>
        <label style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`Schedule ${label}`}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
          {checked ? '✓' : ''}
        </label>
      </td>
    </>
  );
}

/** The selected row on the other side of an index/input relation, by name and every LOINC it answers for. */
export type Relation = { name: string; loincs: string[] };

const overlaps = (a: string[], b: string[]) => a.some((x) => b.includes(x));

/** Fixed-width gutter before every name, so marking a row never shifts the text next to it. */
function RelationMark({ label }: Readonly<{ label: string | undefined }>) {
  return (
    <span aria-label={label} style={{ display: 'inline-block', width: 10, marginRight: 3, color: '#1971c2' }}>
      {label && '•'}
    </span>
  );
}

type CellPress = (e: { currentTarget: HTMLElement }) => void;

/**
 * The two-step data-cell interaction shared by observation and index rows: a
 * first click selects the row and arms the cell, a second click on the armed
 * cell opens its popup. `onOpen` is undefined for a cell with no value, which
 * therefore never leaves the arming step.
 */
function armedCellHandler({
  selectedCell, rowKey, date, onSelect, onSelectCell, onOpen,
}: Readonly<{
  selectedCell: SelectedCell;
  rowKey: string;
  date: string;
  onSelect: (key: string) => void;
  onSelectCell: (key: string, date: string) => void;
  onOpen: CellPress | undefined;
}>): CellPress {
  return (e) => {
    if (onOpen && isCellArmed(selectedCell, rowKey, date)) {
      onOpen(e);
    } else {
      onSelect(rowKey);
      onSelectCell(rowKey, date);
    }
  };
}

export type ObservationTableProps = {
  label: string;
  rows: Observation[];
  visibleDates: string[];
  allResults: ResultEntry[];
  unitSystem: 'si' | 'us';
  selectedLoinc: string | null;
  onSelect: (loinc: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  /** Which single (row, date) data cell is armed for a second click to open. */
  selectedCell: SelectedCell;
  onSelectCell: (loinc: string, date: string) => void;
  /** Second click on an already-armed cell: open the result popup for that specific value. */
  onOpenResultPopup: (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => void;
  /** Show the lab's raw string (qualifiers like "<0.1") when no unit conversion applies. */
  preferRaw?: boolean;
  /** When set, appends the Scheduled toggle column. */
  scheduling?: RowScheduling;
  /** The selected computed index: rows answering for any of its input `loincs` get a mark before their name (Panel Detail only). */
  inputsOf?: Relation;
};

/** One observation row's cells across the visible dates. */
function ObservationCells({
  test, cells, showCellUnits, selected, selectedCell, onSelect, onSelectCell, onOpenResultPopup, preferRaw,
}: Readonly<{
  test: Observation;
  cells: RowCell[];
  showCellUnits: boolean;
  selected: boolean;
  selectedCell: SelectedCell;
  onSelect: (loinc: string) => void;
  onSelectCell: (loinc: string, date: string) => void;
  onOpenResultPopup: ObservationTableProps['onOpenResultPopup'];
  preferRaw?: boolean;
}>) {
  return (
    <>
      {cells.map(({ date, match, display }) => {
        const handleClick = armedCellHandler({
          selectedCell,
          rowKey: test.loinc,
          date,
          onSelect,
          onSelectCell,
          onOpen: match ? (e) => onOpenResultPopup(test, match, e) : undefined,
        });
        if (!match || !display) {
          return (
            <td key={date} {...pressable(handleClick)} style={td}>
              –
            </td>
          );
        }
        const bg = cellBg(hasReference(match.result), isOutOfRange(match.result), selected);
        // Coloring always uses the as-reported value/range (self-consistent);
        // only the displayed number is converted for the toggle, and then it is
        // shown under the unit it was converted TO (see displayedResult).
        const text = !display.converted && preferRaw ? display.rawValue || fmtNum(display.value) : fmtNum(display.value);
        return (
          <td key={date} {...pressable(handleClick)} style={{ ...td, background: bg }}>
            {text}
            {showCellUnits && display.unit && <span style={{ color: '#888' }}> {display.unit}</span>}
          </td>
        );
      })}
    </>
  );
}

export function ObservationTable(props: Readonly<ObservationTableProps>) {
  const {
    label, rows, visibleDates, allResults, unitSystem, selectedLoinc, onSelect, onOpenPopup,
    onSelectCell, onOpenResultPopup, selectedCell, preferRaw, scheduling, inputsOf,
  } = props;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={table}>
        <ColGroup dates={visibleDates} scheduling={!!scheduling} />
        <TableHead label={label} dates={visibleDates} scheduling={!!scheduling} />
        <tbody>
          {rows.map((test) => {
            const selected = selectedLoinc === test.loinc;
            const { cells, rowUnit, showCellUnits } = buildRowCells(test, visibleDates, allResults, unitSystem);
            const rowLoincs = testLoincs(test);
            return (
              <tr key={test.loinc} style={{ background: selected ? '#eaf3fb' : undefined }}>
                <td
                  {...pressable((e) => {
                    onSelect(test.loinc);
                    onOpenPopup(test, e);
                  })}
                  style={labelTd}
                >
                  <RelationMark label={inputsOf && overlaps(rowLoincs, inputsOf.loincs) ? `input of ${inputsOf.name}` : undefined} />
                  <span style={{ fontWeight: 600 }}>{test.short}</span>
                  {rowUnit && `, ${rowUnit}`}
                </td>
                <ObservationCells
                  test={test}
                  cells={cells}
                  showCellUnits={showCellUnits}
                  selected={selected}
                  selectedCell={selectedCell}
                  onSelect={onSelect}
                  onSelectCell={onSelectCell}
                  onOpenResultPopup={onOpenResultPopup}
                  preferRaw={preferRaw}
                />
                {scheduling && (
                  <ScheduledCell
                    checked={isRowScheduled(scheduling.scheduled, rowLoincs)}
                    label={test.short}
                    onToggle={() => scheduling.onToggle(rowLoincs)}
                  />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function IndexTable({
  defs, visibleDates, resultsByDate, selectedLoinc, onSelect, onOpenPopup, selectedCell, onSelectCell, onOpenIndexResultPopup, scheduling, usedBy,
}: Readonly<{
  defs: IndexDef[];
  visibleDates: string[];
  resultsByDate: Record<string, Record<string, Result>>;
  selectedLoinc: string | null;
  onSelect: (key: string) => void;
  onOpenPopup: (def: IndexDef, e: { currentTarget: HTMLElement }) => void;
  /** Which single (index, date) data cell is armed for a second click to open. */
  selectedCell: SelectedCell;
  onSelectCell: (key: string, date: string) => void;
  /** Second click on an already-armed cell: open the simple value popup for that specific date's value. */
  onOpenIndexResultPopup: (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) => void;
  /** When set, appends the Scheduled toggle column; scheduling an index also schedules its inputs. */
  scheduling?: IndexScheduling;
  /** The selected observation: indices reading any of its `loincs` get a mark before their name (Panel Detail only). */
  usedBy?: Relation;
}>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={table}>
        <ColGroup dates={visibleDates} scheduling={!!scheduling} />
        <TableHead label="Indices" dates={visibleDates} scheduling={!!scheduling} />
        <tbody>
          {defs.map((def) => {
            const selected = selectedLoinc === def.key;
            return (
              <tr key={def.key} style={{ background: selected ? '#eaf3fb' : undefined }}>
                <td
                  {...pressable((e) => {
                    onSelect(def.key);
                    onOpenPopup(def, e);
                  })}
                  style={labelTd}
                >
                  <RelationMark label={usedBy && overlaps(indexInputLoincs(def.key), usedBy.loincs) ? `uses ${usedBy.name}` : undefined} />
                  <span style={{ fontWeight: 600 }}>{def.nameCompact}</span>
                  {def.unit && `, ${def.unit}`}
                </td>
                {visibleDates.map((date) => {
                  const value = computeIndex(def, resultsByDate[date] ?? {});
                  const handleClick = armedCellHandler({
                    selectedCell,
                    rowKey: def.key,
                    date,
                    onSelect,
                    onSelectCell,
                    onOpen: value == null ? undefined : (e) => onOpenIndexResultPopup(def, date, value, e),
                  });
                  if (value == null) {
                    return (
                      <td key={date} {...pressable(handleClick)} style={td}>
                        –
                      </td>
                    );
                  }
                  const z = zone(value, def.cut[0], def.cut[1], def.hi);
                  return (
                    <td key={date} {...pressable(handleClick)} style={{ ...td, background: selected ? SELECTED_ZONE_BG[z] : ZONE_BG[z] }}>
                      {fmtNum(value)}
                    </td>
                  );
                })}
                {scheduling && (
                  <ScheduledCell
                    checked={isIndexScheduled(scheduling.scheduled, def.key)}
                    label={def.nameCompact}
                    onToggle={() => scheduling.onToggle(def.key)}
                  />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
