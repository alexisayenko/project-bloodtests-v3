import { fmtNum, isOutOfRange } from '../../utils/format';
import { computeIndex, zone, type IndexDef } from '../../data/computedIndices';
import { testLoincs, type Observation } from './markers';
import {
  ZONE_BG,
  SELECTED_ZONE_BG,
  LABEL_COL_WIDTH,
  buildRowCells,
  formatMonthYear,
  indexInputEntries,
  labsByDate,
  pressable,
  cellBg,
  isCellArmed,
  type RowCell,
  type SelectedCell,
} from './ui';
import { TableScroller } from './TableScroller';
import { hasReference, type ResultEntry } from './resultsLookup';
import {
  indexInputLoincs,
  isIndexScheduled,
  isRowScheduled,
  selectionState,
  type IndexScheduling,
  type RowScheduling,
} from './scheduled';
import { ScheduleHeader, type ScheduleHeaderProps } from './ScheduleHeader';
import type { Result } from '../../types';
import { COLOR } from '../../styles/tokens';

const DATE_COL_WIDTH = 96;
// The Scheduled column sits after an empty spacer column so it reads as a
// separate block from the date grid while staying in the same table (exact
// row alignment for free).
const GAP_COL_WIDTH = 16;
// Fits the header's widest row: the month pill at its longest option (91px),
// the 8px gap, the select-all box and the cell padding. The body cells stay a
// single glyph.
const SCHEDULED_COL_WIDTH = 132;

const th = {
  textAlign: 'left',
  padding: '8px 12px',
  verticalAlign: 'top',
  borderBottom: `1.5px solid ${COLOR.accent}`,
  whiteSpace: 'nowrap',
} as const;
const labLine = {
  height: 14,
  lineHeight: '14px',
  fontSize: 11,
  fontWeight: 400,
  color: COLOR.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;
const td = { padding: '8px 12px', borderBottom: `1px solid ${COLOR.borderSubtle}`, whiteSpace: 'nowrap', cursor: 'pointer' } as const;
const labelTd = { ...td, whiteSpace: 'normal', overflowWrap: 'anywhere' } as const;
const gapCell = { padding: 0, border: 'none' } as const;
const scheduledTh = {
  ...th,
  textAlign: 'center',
  padding: '6px 8px',
  verticalAlign: 'middle',
  borderLeft: `1px solid ${COLOR.borderMuted}`,
  borderRight: `1px solid ${COLOR.borderMuted}`,
} as const;
const scheduledTd = {
  ...td,
  textAlign: 'center',
  borderLeft: `1px solid ${COLOR.borderMuted}`,
  borderRight: `1px solid ${COLOR.borderMuted}`,
  color: COLOR.accent,
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

function TableHead({
  label, dates, labs, schedule,
}: Readonly<{ label: string; dates: string[]; labs?: Record<string, string[]>; schedule?: ScheduleHeaderProps }>) {
  return (
    <thead>
      <tr>
        <th style={th}>{label}</th>
        {dates.map((date) => {
          const names = labs?.[date]?.join(', ') ?? '';
          return (
            <th key={date} style={th}>
              {formatMonthYear(date)}
              {labs && (
                <div style={labLine} title={names || undefined}>
                  {names}
                </div>
              )}
            </th>
          );
        })}
        {schedule && (
          <>
            <th style={gapCell} />
            {/* The header holds only controls, so aria-label supplies the column
                name that the removed caption used to give it. */}
            <th style={scheduledTh} aria-label="Scheduled">
              <ScheduleHeader {...schedule} />
            </th>
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
    <span aria-label={label} style={{ display: 'inline-block', width: 10, marginRight: 3, color: COLOR.accent }}>
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
  /** Adds the laboratory select and total to the Scheduled header (Panel Detail only). */
  showPricing?: boolean;
  /** Names the laboratories under each date in the header (Panel Detail only). */
  showLabs?: boolean;
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
            {showCellUnits && display.unit && <span style={{ color: COLOR.textMuted }}> {display.unit}</span>}
          </td>
        );
      })}
    </>
  );
}

const sectionDividerTd = {
  ...th,
  padding: '14px 12px 6px',
  fontWeight: 700,
  fontSize: 12,
  color: COLOR.textSecondary,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  borderTop: `1px solid ${COLOR.borderSubtle}`,
  borderBottom: `1.5px solid ${COLOR.accent}`,
  backgroundColor: COLOR.surface,
  whiteSpace: 'nowrap' as const,
};

const sectionDividerRestTd = {
  padding: 0,
  borderTop: `1px solid ${COLOR.borderSubtle}`,
  borderBottom: `1.5px solid ${COLOR.accent}`,
  backgroundColor: COLOR.surface,
};

function ObservationRow({
  test,
  cells,
  rowUnit,
  showCellUnits,
  selected,
  selectedCell,
  onSelect,
  onOpenPopup,
  onSelectCell,
  onOpenResultPopup,
  preferRaw,
  scheduling,
  inputsOf,
}: Readonly<{
  test: Observation;
  cells: RowCell[];
  rowUnit?: string;
  showCellUnits: boolean;
  selected: boolean;
  selectedCell: SelectedCell;
  onSelect: (loinc: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  onSelectCell: (loinc: string, date: string) => void;
  onOpenResultPopup: (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => void;
  preferRaw?: boolean;
  scheduling?: RowScheduling;
  inputsOf?: Relation;
}>) {
  const rowLoincs = testLoincs(test);
  return (
    <tr key={test.loinc} data-selected={selected || undefined} style={{ background: selected ? COLOR.accentSoft : undefined }}>
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
}

function IndexDefRow({
  def,
  visibleDates,
  resultsByDate,
  selected,
  selectedCell,
  onSelect,
  onOpenPopup,
  onSelectCell,
  onOpenIndexResultPopup,
  scheduling,
  usedBy,
}: Readonly<{
  def: IndexDef;
  visibleDates: string[];
  resultsByDate?: Record<string, Record<string, Result>>;
  selected: boolean;
  selectedCell: SelectedCell;
  onSelect: (key: string) => void;
  onOpenPopup?: (def: IndexDef, e: { currentTarget: HTMLElement }) => void;
  onSelectCell: (key: string, date: string) => void;
  onOpenIndexResultPopup?: (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) => void;
  scheduling?: IndexScheduling;
  usedBy?: Relation;
}>) {
  return (
    <tr key={def.key} data-selected={selected || undefined} style={{ background: selected ? COLOR.accentSoft : undefined }}>
      <td
        {...(onOpenPopup
          ? pressable((e) => {
              onSelect(def.key);
              onOpenPopup(def, e);
            })
          : pressable(() => onSelect(def.key)))}
        style={labelTd}
      >
        <RelationMark label={usedBy && overlaps(indexInputLoincs(def.key), usedBy.loincs) ? `uses ${usedBy.name}` : undefined} />
        <span style={{ fontWeight: 600 }}>{def.nameCompact}</span>
        {def.unit && `, ${def.unit}`}
      </td>
      {visibleDates.map((date) => {
        const value = resultsByDate ? computeIndex(def, resultsByDate[date] ?? {}) : null;
        const handleClick = armedCellHandler({
          selectedCell,
          rowKey: def.key,
          date,
          onSelect,
          onSelectCell,
          onOpen: value == null || !onOpenIndexResultPopup ? undefined : (e) => onOpenIndexResultPopup(def, date, value, e),
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
}

export type ResultsTableProps = {
  label?: string;
  rows?: Observation[];
  indices?: Observation[];
  defs?: IndexDef[];
  visibleDates: string[];
  allResults: ResultEntry[];
  resultsByDate?: Record<string, Record<string, Result>>;
  unitSystem: 'si' | 'us';
  selectedLoinc: string | null;
  onSelect: (loinc: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  onOpenIndexPopup?: (def: IndexDef, e: { currentTarget: HTMLElement }) => void;
  selectedCell: SelectedCell;
  onSelectCell: (loinc: string, date: string) => void;
  onOpenResultPopup: (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => void;
  onOpenIndexResultPopup?: (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) => void;
  preferRaw?: boolean;
  scheduling?: RowScheduling;
  indexScheduling?: IndexScheduling;
  showPricing?: boolean;
  showLabs?: boolean;
  inputsOf?: Relation;
  usedBy?: Relation;
};

export function ResultsTable(props: Readonly<ResultsTableProps>) {
  const {
    label,
    rows = [],
    indices = [],
    defs = [],
    visibleDates,
    allResults,
    resultsByDate,
    unitSystem,
    selectedLoinc,
    onSelect,
    onOpenPopup,
    onOpenIndexPopup,
    onSelectCell,
    onOpenResultPopup,
    onOpenIndexResultPopup,
    selectedCell,
    preferRaw,
    scheduling,
    indexScheduling,
    inputsOf,
    usedBy,
    showPricing,
    showLabs,
  } = props;

  const hasObs = rows.length > 0;
  const hasIndices = indices.length > 0 || defs.length > 0;
  const tableLabel = hasObs ? (label ?? 'Observations') : 'Indices';

  const builtRows = rows.map((test) => ({ test, ...buildRowCells(test, visibleDates, allResults, unitSystem) }));
  const builtIndexRows = indices.map((test) => ({ test, ...buildRowCells(test, visibleDates, allResults, unitSystem) }));

  const labs = showLabs
    ? labsByDate([
        ...builtRows.flatMap(({ cells }) => cells.map((cell) => cell.match)),
        ...builtIndexRows.flatMap(({ cells }) => cells.map((cell) => cell.match)),
        ...(defs.length > 0 && resultsByDate ? indexInputEntries(defs, visibleDates, allResults, resultsByDate) : []),
      ])
    : undefined;

  const hasScheduling = Boolean(scheduling || indexScheduling);
  const visibleRowLoincs = [
    ...rows.map(testLoincs),
    ...indices.map(testLoincs),
  ];
  const visibleKeys = defs.map((def) => def.key);

  const observationFlags = scheduling
    ? visibleRowLoincs.map((loincs) => isRowScheduled(scheduling.scheduled, loincs))
    : [];
  const indexFlags = (indexScheduling && defs.length > 0)
    ? visibleKeys.map((key) => isIndexScheduled(indexScheduling.scheduled, key))
    : [];
  const allFlags = [...observationFlags, ...indexFlags];

  const schedule = hasScheduling && {
    label: tableLabel,
    month: (scheduling ?? indexScheduling)?.scheduled.month,
    onSetMonth: (scheduling ?? indexScheduling)?.onSetMonth ?? (() => {}),
    state: selectionState(allFlags),
    onToggleAll: (on: boolean) => {
      if (scheduling && visibleRowLoincs.length > 0) {
        scheduling.onToggleAll(visibleRowLoincs, on);
      }
      if (indexScheduling && visibleKeys.length > 0) {
        indexScheduling.onToggleAll(visibleKeys, on);
      }
    },
    showPricing,
  };

  const otherColSpan = visibleDates.length + (hasScheduling ? 2 : 0) + 1;

  return (
    <TableScroller
      colgroup={<ColGroup dates={visibleDates} scheduling={hasScheduling} />}
      head={<TableHead label={tableLabel} dates={visibleDates} labs={labs} schedule={schedule || undefined} />}
    >
      <tbody>
        {builtRows.map(({ test, cells, rowUnit, showCellUnits }) => (
          <ObservationRow
            key={test.loinc}
            test={test}
            cells={cells}
            rowUnit={rowUnit}
            showCellUnits={showCellUnits}
            selected={selectedLoinc === test.loinc}
            selectedCell={selectedCell}
            onSelect={onSelect}
            onOpenPopup={onOpenPopup}
            onSelectCell={onSelectCell}
            onOpenResultPopup={onOpenResultPopup}
            preferRaw={preferRaw}
            scheduling={scheduling}
            inputsOf={inputsOf}
          />
        ))}
        {hasObs && hasIndices && (
          <tr key="__indices_divider__">
            <td style={sectionDividerTd}>Indices</td>
            <td colSpan={otherColSpan} style={sectionDividerRestTd} />
          </tr>
        )}
        {builtIndexRows.map(({ test, cells, rowUnit, showCellUnits }) => (
          <ObservationRow
            key={test.loinc}
            test={test}
            cells={cells}
            rowUnit={rowUnit}
            showCellUnits={showCellUnits}
            selected={selectedLoinc === test.loinc}
            selectedCell={selectedCell}
            onSelect={onSelect}
            onOpenPopup={onOpenPopup}
            onSelectCell={onSelectCell}
            onOpenResultPopup={onOpenResultPopup}
            preferRaw={preferRaw}
            scheduling={scheduling}
            inputsOf={inputsOf}
          />
        ))}
        {defs.map((def) => (
          <IndexDefRow
            key={def.key}
            def={def}
            visibleDates={visibleDates}
            resultsByDate={resultsByDate}
            selected={selectedLoinc === def.key}
            selectedCell={selectedCell}
            onSelect={onSelect}
            onOpenPopup={onOpenIndexPopup}
            onSelectCell={onSelectCell}
            onOpenIndexResultPopup={onOpenIndexResultPopup}
            scheduling={indexScheduling}
            usedBy={usedBy}
          />
        ))}
      </tbody>
    </TableScroller>
  );
}

export function ObservationTable(props: Readonly<ObservationTableProps>) {
  return <ResultsTable {...props} />;
}

export type IndexTableProps = {
  defs: IndexDef[];
  visibleDates: string[];
  allResults: ResultEntry[];
  resultsByDate: Record<string, Record<string, Result>>;
  selectedLoinc: string | null;
  onSelect: (key: string) => void;
  onOpenPopup: (def: IndexDef, e: { currentTarget: HTMLElement }) => void;
  selectedCell: SelectedCell;
  onSelectCell: (key: string, date: string) => void;
  onOpenIndexResultPopup: (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) => void;
  scheduling?: IndexScheduling;
  usedBy?: Relation;
  showPricing?: boolean;
  showLabs?: boolean;
};

export function IndexTable(props: Readonly<IndexTableProps>) {
  const { onOpenPopup, scheduling, ...rest } = props;
  return (
    <ResultsTable
      {...rest}
      label="Indices"
      rows={[]}
      onOpenPopup={() => {}}
      onOpenIndexPopup={onOpenPopup}
      onOpenResultPopup={() => {}}
      unitSystem="si"
      indexScheduling={scheduling}
    />
  );
}
