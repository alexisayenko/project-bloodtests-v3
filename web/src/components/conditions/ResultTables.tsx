import { fmtNum, isOutOfRange } from '../../utils/format';
import { SI_US_UNIT, computeIndex, toUnit, zone, type IndexDef } from '../../data/computedIndices';
import { LOINC_TO_MARKER, testLoincs, type Observation } from './markers';
import { ZONE_BG, SELECTED_ZONE_BG, formatMonthYear, pressable, cellBg, isCellArmed, type SelectedCell } from './ui';
import { hasReference, type ResultEntry } from './resultsLookup';
import { indexInputLoincs, isIndexScheduled, isRowScheduled, type Scheduled } from './scheduled';
import type { Result } from '../../types';

const DATE_COL_WIDTH = 96;
// Shared across observations and both indices tables so they line up as one block.
const LABEL_COL_WIDTH = 140;
// The Scheduled column sits after an empty spacer column so it reads as a
// separate block from the date grid while staying in the same table (exact
// row alignment for free).
const GAP_COL_WIDTH = 16;
const SCHEDULED_COL_WIDTH = 96;

const th = {
  width: DATE_COL_WIDTH,
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1.5px solid #1971c2',
  whiteSpace: 'nowrap',
} as const;
const td = { width: DATE_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' } as const;
const gapCell = { width: GAP_COL_WIDTH, padding: 0, border: 'none' } as const;
const scheduledTh = {
  ...th,
  width: SCHEDULED_COL_WIDTH,
  textAlign: 'center',
  borderLeft: '1px solid #ddd',
  borderRight: '1px solid #ddd',
} as const;
const scheduledTd = {
  ...td,
  width: SCHEDULED_COL_WIDTH,
  textAlign: 'center',
  borderLeft: '1px solid #ddd',
  borderRight: '1px solid #ddd',
  color: '#1971c2',
  fontWeight: 600,
  userSelect: 'none',
} as const;

function TableHead({ label, dates, scheduling }: Readonly<{ label: string; dates: string[]; scheduling: boolean }>) {
  return (
    <thead>
      <tr>
        <th style={{ ...th, width: LABEL_COL_WIDTH }}>{label}</th>
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
      <td
        {...pressable(onToggle)}
        role="checkbox"
        aria-checked={checked}
        aria-label={`Schedule ${label}`}
        title={checked ? 'Scheduled -- click to unschedule' : 'Click to schedule'}
        style={scheduledTd}
      >
        {checked ? '✓' : ''}
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
  /** When set, appends the Scheduled toggle column (Panel Detail only). */
  scheduling?: { scheduled: Scheduled; onToggle: (loincs: string[]) => void };
  /** The selected computed index: rows answering for any of its input `loincs` get a mark before their name (Panel Detail only). */
  inputsOf?: Relation;
};

/** One observation row's cells across the visible dates. */
function ObservationCells({
  test, visibleDates, allResults, unitSystem, selected, selectedCell, onSelect, onSelectCell, onOpenResultPopup, preferRaw,
}: Readonly<Omit<ObservationTableProps, 'label' | 'rows' | 'selectedLoinc' | 'onOpenPopup'> & { test: Observation; selected: boolean }>) {
  const marker = LOINC_TO_MARKER[test.loinc];
  const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
  const rowLoincs = testLoincs(test);
  return (
    <>
      {visibleDates.map((date) => {
        const match = allResults.find((r) => r.date === date && rowLoincs.includes(r.loinc)) ?? null;
        const armed = isCellArmed(selectedCell, test.loinc, date);
        const handleClick = (e: { currentTarget: HTMLElement }) => {
          if (armed && match) {
            onOpenResultPopup(test, match, e);
          } else {
            onSelect(test.loinc);
            onSelectCell(test.loinc, date);
          }
        };
        if (!match) {
          return (
            <td key={date} {...pressable(handleClick)} style={td}>
              –
            </td>
          );
        }
        const bg = cellBg(hasReference(match.result), isOutOfRange(match.result), selected);
        // Coloring always uses the as-reported value/range (self-consistent);
        // only the displayed number is converted for the toggle.
        const converted =
          siUsUnit && match.result.value != null
            ? toUnit(match.result.value, marker!, match.result.unit, siUsUnit[unitSystem])
            : match.result.value;
        const text = !siUsUnit && preferRaw ? match.result.rawValue || fmtNum(match.result.value) : fmtNum(converted);
        return (
          <td key={date} {...pressable(handleClick)} style={{ ...td, background: bg }}>
            {text}
          </td>
        );
      })}
    </>
  );
}

export function ObservationTable(props: Readonly<ObservationTableProps>) {
  const { label, rows, visibleDates, unitSystem, selectedLoinc, onSelect, onOpenPopup, scheduling, inputsOf } = props;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <TableHead label={label} dates={visibleDates} scheduling={!!scheduling} />
        <tbody>
          {rows.map((test) => {
            const selected = selectedLoinc === test.loinc;
            const marker = LOINC_TO_MARKER[test.loinc];
            const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
            const displayUnit = siUsUnit ? siUsUnit[unitSystem] : test.unit;
            const rowLoincs = testLoincs(test);
            return (
              <tr key={test.loinc} style={{ background: selected ? '#eaf3fb' : undefined }}>
                <td
                  {...pressable((e) => {
                    onSelect(test.loinc);
                    onOpenPopup(test, e);
                  })}
                  style={{ ...td, width: LABEL_COL_WIDTH }}
                >
                  <RelationMark label={inputsOf && overlaps(rowLoincs, inputsOf.loincs) ? `input of ${inputsOf.name}` : undefined} />
                  <span style={{ fontWeight: 600 }}>{test.short}</span>
                  {displayUnit && `, ${displayUnit}`}
                </td>
                <ObservationCells {...props} test={test} selected={selected} />
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
  scheduling?: { scheduled: Scheduled; onToggle: (key: string) => void };
  /** The selected observation: indices reading any of its `loincs` get a mark before their name (Panel Detail only). */
  usedBy?: Relation;
}>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
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
                  style={{ ...td, width: LABEL_COL_WIDTH }}
                >
                  <RelationMark label={usedBy && overlaps(indexInputLoincs(def.key), usedBy.loincs) ? `uses ${usedBy.name}` : undefined} />
                  <span style={{ fontWeight: 600 }}>{def.nameCompact}</span>
                  {def.unit && `, ${def.unit}`}
                </td>
                {visibleDates.map((date) => {
                  const value = computeIndex(def, resultsByDate[date] ?? {});
                  const armed = isCellArmed(selectedCell, def.key, date);
                  const handleClick = (e: { currentTarget: HTMLElement }) => {
                    if (armed && value != null) {
                      onOpenIndexResultPopup(def, date, value, e);
                    } else {
                      onSelect(def.key);
                      onSelectCell(def.key, date);
                    }
                  };
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
