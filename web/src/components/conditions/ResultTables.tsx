import type { ReactNode } from 'react';
import { fmtNum, isOutOfRange } from '../../utils/format';
import { computeIndex, indexZone, type IndexDef } from '../../data/computedIndices';
import { loadEnvelopeMeta } from '../../data/envelopeMeta';
import { testLoincs, type Observation } from './markers';
import {
  ZONE_BG,
  SELECTED_ZONE_BG,
  LABEL_COL_WIDTH,
  buildRowCells,
  cellBg,
  isCellArmed,
  type RowCell,
  type SelectedCell,
} from './resultCells';
import { TableScroller } from './TableScroller';
import { formatMonthYear } from '../../data/months';
import { hasReference, type ResultEntry } from './resultsLookup';
import { indexInputLoincs, isIndexScheduled, isRowScheduled } from '../../data/storage/scheduledVisits';
import { ScheduleHeader, type ScheduleHeaderProps } from './ScheduleHeader';
import { usePopupContext } from './PopupContext';
import { useSchedulingContext } from './SchedulingContext';
import type { Result, UnitSystem } from '../../types';
import { COLOR } from '../../styles/tokens';
import { CARD_TABLE_TD, CARD_TABLE_TH, TABLE_CARD, pressable } from '../primitives/styles';
import { Card } from '../primitives/Card';

const DATE_COL_WIDTH = 96;
const GAP_COL_WIDTH = 16;
// Fits the header's widest row: the month pill at its longest option, gaps, remove button and padding.
const SCHEDULED_COL_WIDTH = 130;
const ADD_COL_WIDTH = 40;

const HAIRLINE = `1px solid ${COLOR.borderSubtle}`;

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
const addTh = { ...th, textAlign: 'center', padding: '6px 4px' } as const;

const STATUS_TEXT = { ok: COLOR.statusOkText, warn: COLOR.statusWarnText, bad: COLOR.statusBadText } as const;

/** The negative margin cancels the tint's padding, so digits stay on the header's left edge whether tinted or not. */
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

/** The card hugs this width, so the trailing auto column stays empty and the hairlines end where the columns do. */
function gridWidth(dateCount: number, visitCount: number): number {
  return LABEL_COL_WIDTH + dateCount * DATE_COL_WIDTH + GAP_COL_WIDTH + visitCount * SCHEDULED_COL_WIDTH + ADD_COL_WIDTH;
}

function ColGroup({ dates, visitCount }: Readonly<{ dates: string[]; visitCount: number }>) {
  return (
    <colgroup>
      <col style={{ width: LABEL_COL_WIDTH }} />
      {dates.map((date) => (
        <col key={date} style={{ width: DATE_COL_WIDTH }} />
      ))}
      <col style={{ width: GAP_COL_WIDTH }} />
      {Array.from({ length: visitCount }, (_, i) => (
        <col key={i} style={{ width: SCHEDULED_COL_WIDTH }} />
      ))}
      <col style={{ width: ADD_COL_WIDTH }} />
      {/* Trailing auto column soaks up the leftover width so the grid keeps its px widths. */}
      <col />
    </colgroup>
  );
}

function TableHead({
  label, dates, schedules, onAddVisit,
}: Readonly<{ label: string; dates: string[]; schedules: (ScheduleHeaderProps & { visitId: string })[]; onAddVisit: () => void }>) {
  return (
    <thead>
      <tr>
        <th style={th}>{label}</th>
        {dates.map((date) => (
          <th key={date} style={th}>
            {formatMonthYear(date)}
          </th>
        ))}
        <th style={gapTh} />
        {schedules.map((schedule) => (
          <th key={schedule.visitId} style={scheduledTh} aria-label="Scheduled visit">
            <ScheduleHeader {...schedule} />
          </th>
        ))}
        <th style={addTh}>
          <button
            type="button"
            onClick={onAddVisit}
            aria-label="Add a scheduled visit"
            title="Add a scheduled visit"
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              border: `1px solid ${COLOR.borderSubtle}`,
              background: COLOR.surface,
              color: COLOR.primary,
              fontSize: 15,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </th>
      </tr>
    </thead>
  );
}

/** Single-click toggle marking a row for the next draw -- no arming step, unlike the value cells. */
function ScheduledCell({ checked, label, onToggle }: Readonly<{ checked: boolean; label: string; onToggle: () => void }>) {
  return (
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
  );
}

/** The gap-column-plus-add-column pair every scheduling row ends with, so the trailing add column stays blank but present. */
function ScheduleRowEnd() {
  return <td style={gapCell} />;
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

/** First click arms the cell, second opens its popup; `onOpen` undefined (no value) never leaves the arming step. */
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
  test, cells, showCellUnits, selected, preferRaw,
}: Readonly<{
  test: Observation;
  cells: RowCell[];
  showCellUnits: boolean;
  selected: boolean;
  preferRaw?: boolean;
}>) {
  const { selectedCell, onSelect, onSelectCell, openResultPopup } = usePopupContext();
  return (
    <>
      {cells.map(({ date, match, display }) => {
        const handleClick = armedCellHandler({
          selectedCell,
          rowKey: test.loinc,
          date,
          onSelect,
          onSelectCell,
          onOpen: match ? (e) => openResultPopup(test, match, e) : undefined,
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
        // Coloring uses the as-reported value/range; only the displayed number is converted.
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

/** Spans exactly the grid's real columns, never the trailing auto column, so the Scheduled side rules stay unbroken. */
function SectionDividerRow({ label, dateCount, visitCount }: Readonly<{ label: string; dateCount: number; visitCount: number }>) {
  const scheduleColSpan = visitCount + 2;
  return (
    <tr>
      <th scope="rowgroup" style={th}>{label}</th>
      {dateCount > 0 && <td colSpan={dateCount} style={th} />}
      <td colSpan={scheduleColSpan} style={gapTh} />
    </tr>
  );
}

function ObservationRow({
  test,
  cells,
  rowUnit,
  showCellUnits,
  selected,
  preferRaw,
  inputsOf,
}: Readonly<{
  test: Observation;
  cells: RowCell[];
  rowUnit?: string;
  showCellUnits: boolean;
  selected: boolean;
  preferRaw?: boolean;
  inputsOf?: Relation;
}>) {
  const { onSelect, openPopup } = usePopupContext();
  const { rowSchedulings } = useSchedulingContext();
  const rowLoincs = testLoincs(test);
  return (
    <tr key={test.loinc} data-selected={selected || undefined} style={{ background: selected ? COLOR.accentSoft : undefined }}>
      <td
        {...pressable((e) => {
          onSelect(test.loinc);
          openPopup(test, e);
        })}
        style={labelTd}
      >
        <RelationMark label={inputsOf && overlaps(rowLoincs, inputsOf.loincs) ? `input of ${inputsOf.name}` : undefined} />
        <span style={{ fontWeight: 600 }}>{test.shortName}</span>
        {rowUnit && <span style={{ color: COLOR.textMuted }}>, {rowUnit}</span>}
      </td>
      <ObservationCells test={test} cells={cells} showCellUnits={showCellUnits} selected={selected} preferRaw={preferRaw} />
      <td style={gapCell} />
      {rowSchedulings.map((s) => (
        <ScheduledCell
          key={s.scheduled.id}
          checked={isRowScheduled(s.scheduled, rowLoincs)}
          label={test.shortName}
          onToggle={() => s.onToggle(rowLoincs)}
        />
      ))}
      <ScheduleRowEnd />
    </tr>
  );
}

function IndexDefRow({
  def,
  visibleDates,
  resultsByDate,
  selected,
  usedBy,
}: Readonly<{
  def: IndexDef;
  visibleDates: string[];
  resultsByDate?: Record<string, Record<string, Result>>;
  selected: boolean;
  usedBy?: Relation;
}>) {
  const { selectedCell, onSelect, onSelectCell, openIndexPopup, openIndexResultPopup } = usePopupContext();
  const { indexSchedulings } = useSchedulingContext();
  const profile = { sex: loadEnvelopeMeta().sex };
  return (
    <tr key={def.key} data-selected={selected || undefined} style={{ background: selected ? COLOR.accentSoft : undefined }}>
      <td
        {...pressable((e) => {
          onSelect(def.key);
          openIndexPopup(def, e);
        })}
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
          onOpen: value == null ? undefined : (e) => openIndexResultPopup(def, date, value, e),
        });
        if (value == null) {
          return (
            <td key={date} {...pressable(handleClick)} style={emptyTd}>
              –
            </td>
          );
        }
        const z = indexZone(def, value, profile);
        return (
          <td key={date} {...pressable(handleClick)} style={td}>
            {z ? (
              <StatusValue tone={z} bg={selected ? SELECTED_ZONE_BG[z] : ZONE_BG[z]}>
                {fmtNum(value)}
              </StatusValue>
            ) : (
              fmtNum(value)
            )}
          </td>
        );
      })}
      <td style={gapCell} />
      {indexSchedulings.map((s) => (
        <ScheduledCell
          key={s.scheduled.id}
          checked={isIndexScheduled(s.scheduled, def.key)}
          label={def.shortName}
          onToggle={() => s.onToggle(def.key)}
        />
      ))}
      <ScheduleRowEnd />
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
  unitSystem: UnitSystem;
  /** Show the lab's raw string (qualifiers like "<0.1") when no unit conversion applies. */
  preferRaw?: boolean;
  /** The selected computed index: rows answering for any of its input `loincs` get a mark before their name. */
  inputsOf?: Relation;
  usedBy?: Relation;
};

/** Popup, selection and the Scheduled block come from `PopupContext` / `SchedulingContext`, shared with every other table. */
export function ResultsTable(props: Readonly<ResultsTableProps>) {
  const { label, rows = [], indices = [], defs = [], visibleDates, allResults, resultsByDate, unitSystem, preferRaw, inputsOf, usedBy } = props;
  const { selectedLoinc } = usePopupContext();
  const { rowSchedulings, onAddVisit } = useSchedulingContext();

  const hasObs = rows.length > 0;
  const hasIndices = indices.length > 0 || defs.length > 0;
  const tableLabel = hasObs ? (label ?? 'Observations') : 'Indices';

  const builtRows = rows.map((test) => ({ test, ...buildRowCells(test, visibleDates, allResults, unitSystem) }));
  const builtIndexRows = indices.map((test) => ({ test, ...buildRowCells(test, visibleDates, allResults, unitSystem) }));

  const visitCount = rowSchedulings.length;
  const schedules = rowSchedulings.map((rs) => ({
    visitId: rs.scheduled.id,
    month: rs.scheduled.month,
    onSetMonth: rs.onSetMonth,
    onRemove: rs.onRemove,
  }));

  const table = (
    <TableScroller
      colgroup={<ColGroup dates={visibleDates} visitCount={visitCount} />}
      head={<TableHead label={tableLabel} dates={visibleDates} schedules={schedules} onAddVisit={onAddVisit} />}
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
            preferRaw={preferRaw}
            inputsOf={inputsOf}
          />
        ))}
        {hasObs && hasIndices && (
          <SectionDividerRow key="__indices_divider__" label="Indices" dateCount={visibleDates.length} visitCount={visitCount} />
        )}
        {builtIndexRows.map(({ test, cells, rowUnit, showCellUnits }) => (
          <ObservationRow
            key={test.loinc}
            test={test}
            cells={cells}
            rowUnit={rowUnit}
            showCellUnits={showCellUnits}
            selected={selectedLoinc === test.loinc}
            preferRaw={preferRaw}
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
            usedBy={usedBy}
          />
        ))}
      </tbody>
    </TableScroller>
  );

  return (
    <Card className="mc-results-card" style={{ ...TABLE_CARD, width: `min(100%, ${gridWidth(visibleDates.length, visitCount) + 2}px)` }}>
      {table}
    </Card>
  );
}
