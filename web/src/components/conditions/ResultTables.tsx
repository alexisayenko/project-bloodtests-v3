import type { ReactNode } from 'react';
import { fmtNum, isOutOfRange } from '../../utils/format';
import { computeIndex, zone, type IndexDef } from '../../data/computedIndices';
import { testLoincs, type Observation } from './markers';
import {
  ZONE_BG,
  SELECTED_ZONE_BG,
  LABEL_COL_WIDTH,
  buildRowCells,
  formatMonthYear,
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
import { COLOR, FONT } from '../../styles/tokens';
import { CARD_TABLE_TD, CARD_TABLE_TH, TABLE_CARD } from '../primitives/styles';
import { Card } from '../primitives/Card';

const DATE_COL_WIDTH = 96;
// The Scheduled column sits after an empty spacer column so it reads as a
// separate block from the date grid while staying in the same table (exact
// row alignment for free).
const GAP_COL_WIDTH = 16;
// Fits the header's widest row: the month pill at its longest option (91px),
// the 8px gap, the select-all box and the cell padding. The body cells stay a
// single glyph.
const SCHEDULED_COL_WIDTH = 132;

const HAIRLINE = `1px solid ${COLOR.borderSubtle}`;

// A muted band of small uppercase labels, the table's quiet counterpart to the grid's overlines.
const th = { ...CARD_TABLE_TH, padding: '10px 12px', verticalAlign: 'middle' } as const;
const td = { ...CARD_TABLE_TD, padding: '8px 12px', cursor: 'pointer' } as const;
const labelTd = { ...td, whiteSpace: 'normal', overflowWrap: 'anywhere', color: COLOR.navy } as const;
const emptyTd = { ...td, color: COLOR.textDisabled } as const;
const gapCell = { padding: 0, border: 'none' } as const;
const gapTh = { ...gapCell, background: COLOR.surfaceMuted, borderBottom: HAIRLINE } as const;
const scheduledTh = {
  ...th,
  textAlign: 'center',
  padding: '6px 8px',
  borderLeft: HAIRLINE,
  borderRight: HAIRLINE,
} as const;
const scheduledTd = {
  ...td,
  textAlign: 'center',
  borderLeft: HAIRLINE,
  borderRight: HAIRLINE,
  color: COLOR.primary,
  fontWeight: 600,
  userSelect: 'none',
} as const;

const STATUS_TEXT = { ok: COLOR.statusOkText, warn: COLOR.statusWarnText, bad: COLOR.statusBadText } as const;

/**
 * A reading's status as a soft inset tint behind the number rather than a
 * flood across the cell. The negative margin cancels the tint's own padding,
 * so the digits stay on the header's left edge whether a cell is tinted or not.
 */
function StatusValue({ tone, bg, children }: Readonly<{ tone: keyof typeof STATUS_TEXT; bg: string; children: ReactNode }>) {
  return (
    <span
      style={{
        display: 'inline-block',
        margin: '-1px 0 -1px -7px',
        padding: '1px 7px',
        borderRadius: 6,
        background: bg,
        color: STATUS_TEXT[tone],
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </span>
  );
}

/**
 * The grid's own px width. The card hugs it (plus its 1px borders), so the
 * trailing auto column comes out empty and the header band and hairlines end
 * where the columns do; past the available width the card caps and scrolls.
 */
function gridWidth(dateCount: number, scheduling: boolean): number {
  return LABEL_COL_WIDTH + dateCount * DATE_COL_WIDTH + (scheduling ? GAP_COL_WIDTH + SCHEDULED_COL_WIDTH : 0);
}

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
  label, dates, schedule,
}: Readonly<{ label: string; dates: string[]; schedule?: ScheduleHeaderProps }>) {
  return (
    <thead>
      <tr>
        <th style={th}>{label}</th>
        {dates.map((date) => (
          <th key={date} style={th}>
            {formatMonthYear(date)}
          </th>
        ))}
        {schedule && (
          <>
            <th style={gapTh} />
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
  onOpenResultPopup: ResultsTableProps['onOpenResultPopup'];
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
            <td key={date} {...pressable(handleClick)} style={emptyTd}>
              –
            </td>
          );
        }
        const hasRef = hasReference(match.result);
        const outOfRange = isOutOfRange(match.result);
        // Coloring always uses the as-reported value/range (self-consistent);
        // only the displayed number is converted for the toggle, and then it is
        // shown under the unit it was converted TO (see displayedResult).
        const text = !display.converted && preferRaw ? display.rawValue || fmtNum(display.value) : fmtNum(display.value);
        const unit = showCellUnits && display.unit && <span style={{ color: COLOR.textMuted, fontWeight: 400 }}> {display.unit}</span>;
        return (
          <td key={date} {...pressable(handleClick)} style={td}>
            {hasRef ? (
              <StatusValue tone={outOfRange ? 'bad' : 'ok'} bg={cellBg(hasRef, outOfRange, selected)}>
                {text}
                {unit}
              </StatusValue>
            ) : (
              <>
                {text}
                {unit}
              </>
            )}
          </td>
        );
      })}
    </>
  );
}

const sectionDividerTd = {
  textAlign: 'left',
  padding: '14px 12px 4px',
  fontSize: FONT.overline,
  fontWeight: FONT.overlineWeight,
  letterSpacing: FONT.overlineTracking,
  textTransform: 'uppercase',
  color: COLOR.textMuted,
  borderBottom: `1px solid ${COLOR.borderSubtle}`,
  whiteSpace: 'nowrap',
} as const;

const sectionDividerRestTd = { padding: 0, borderBottom: `1px solid ${COLOR.borderSubtle}` } as const;

/**
 * Spans exactly the grid's real columns -- never the trailing auto column, which
 * no other row fills -- and keeps the Scheduled column's side rules unbroken.
 */
function SectionDividerRow({ label, dateCount, scheduling }: Readonly<{ label: string; dateCount: number; scheduling: boolean }>) {
  return (
    <tr>
      <th scope="rowgroup" style={sectionDividerTd}>{label}</th>
      {dateCount > 0 && <td colSpan={dateCount} style={sectionDividerRestTd} />}
      {scheduling && (
        <>
          <td style={gapCell} />
          <td style={{ ...scheduledTd, ...sectionDividerRestTd, cursor: 'default' }} />
        </>
      )}
    </tr>
  );
}

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
        <span style={{ fontWeight: 600 }}>{test.shortName}</span>
        {rowUnit && <span style={{ color: COLOR.textMuted }}>, {rowUnit}</span>}
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
          label={test.shortName}
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
        <span style={{ fontWeight: 600 }}>{def.shortName}</span>
        {def.unit && <span style={{ color: COLOR.textMuted }}>, {def.unit}</span>}
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
            <td key={date} {...pressable(handleClick)} style={emptyTd}>
              –
            </td>
          );
        }
        const z = zone(value, def.cut[0], def.cut[1], def.hi);
        return (
          <td key={date} {...pressable(handleClick)} style={td}>
            <StatusValue tone={z} bg={selected ? SELECTED_ZONE_BG[z] : ZONE_BG[z]}>
              {fmtNum(value)}
            </StatusValue>
          </td>
        );
      })}
      {scheduling && (
        <ScheduledCell
          checked={isIndexScheduled(scheduling.scheduled, def.key)}
          label={def.shortName}
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
  /** Which single (row, date) data cell is armed for a second click to open. */
  selectedCell: SelectedCell;
  onSelectCell: (loinc: string, date: string) => void;
  /** Second click on an already-armed cell: open the result popup for that specific value. */
  onOpenResultPopup: (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => void;
  onOpenIndexResultPopup?: (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) => void;
  /** Show the lab's raw string (qualifiers like "<0.1") when no unit conversion applies. */
  preferRaw?: boolean;
  /** When set, appends the Scheduled toggle column. */
  scheduling?: RowScheduling;
  indexScheduling?: IndexScheduling;
  /** The selected computed index: rows answering for any of its input `loincs` get a mark before their name. */
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
  } = props;

  const hasObs = rows.length > 0;
  const hasIndices = indices.length > 0 || defs.length > 0;
  const tableLabel = hasObs ? (label ?? 'Observations') : 'Indices';

  const builtRows = rows.map((test) => ({ test, ...buildRowCells(test, visibleDates, allResults, unitSystem) }));
  const builtIndexRows = indices.map((test) => ({ test, ...buildRowCells(test, visibleDates, allResults, unitSystem) }));

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
  };

  const table = (
    <TableScroller
      colgroup={<ColGroup dates={visibleDates} scheduling={hasScheduling} />}
      head={<TableHead label={tableLabel} dates={visibleDates} schedule={schedule || undefined} />}
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
          <SectionDividerRow key="__indices_divider__" label="Indices" dateCount={visibleDates.length} scheduling={hasScheduling} />
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

  return (
    <Card className="mc-results-card" style={{ ...TABLE_CARD, width: `min(100%, ${gridWidth(visibleDates.length, hasScheduling) + 2}px)` }}>
      {table}
    </Card>
  );
}

