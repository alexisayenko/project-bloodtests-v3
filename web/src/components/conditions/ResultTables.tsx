import { fmtNum, isOutOfRange } from '../../utils/format';
import { SI_US_UNIT, computeIndex, toUnit, zone, type IndexDef } from '../../data/computedIndices';
import { LOINC_TO_MARKER, testLoincs, type Observation } from './markers';
import { ZONE_BG, SELECTED_ZONE_BG, formatMonthYear, pressable, cellBg } from './ui';
import { hasReference, type ResultEntry } from './resultsLookup';
import type { Result } from '../../types';

const DATE_COL_WIDTH = 96;
// Shared across observations and both indices tables so they line up as one block.
const LABEL_COL_WIDTH = 140;

const th = {
  width: DATE_COL_WIDTH,
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1.5px solid #1971c2',
  whiteSpace: 'nowrap',
} as const;
const td = { width: DATE_COL_WIDTH, padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap', cursor: 'pointer' } as const;

function TableHead({ label, dates }: Readonly<{ label: string; dates: string[] }>) {
  return (
    <thead>
      <tr>
        <th style={{ ...th, width: LABEL_COL_WIDTH }}>{label}</th>
        {dates.map((date) => (
          <th key={date} style={th}>
            {formatMonthYear(date)}
          </th>
        ))}
      </tr>
    </thead>
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
  /** Show the lab's raw string (qualifiers like "<0.1") when no unit conversion applies. */
  preferRaw?: boolean;
};

/** One observation row's cells across the visible dates. */
function ObservationCells({
  test, visibleDates, allResults, unitSystem, selected, onSelect, preferRaw,
}: Readonly<Omit<ObservationTableProps, 'label' | 'rows' | 'selectedLoinc' | 'onOpenPopup'> & { test: Observation; selected: boolean }>) {
  const marker = LOINC_TO_MARKER[test.loinc];
  const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
  const rowLoincs = testLoincs(test);
  return (
    <>
      {visibleDates.map((date) => {
        const match = allResults.find((r) => r.date === date && rowLoincs.includes(r.loinc)) ?? null;
        if (!match) {
          return (
            <td key={date} {...pressable(() => onSelect(test.loinc))} style={td}>
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
          <td key={date} {...pressable(() => onSelect(test.loinc))} style={{ ...td, background: bg }}>
            {text}
          </td>
        );
      })}
    </>
  );
}

export function ObservationTable(props: Readonly<ObservationTableProps>) {
  const { label, rows, visibleDates, unitSystem, selectedLoinc, onSelect, onOpenPopup } = props;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <TableHead label={label} dates={visibleDates} />
        <tbody>
          {rows.map((test) => {
            const selected = selectedLoinc === test.loinc;
            const marker = LOINC_TO_MARKER[test.loinc];
            const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
            const displayUnit = siUsUnit ? siUsUnit[unitSystem] : test.unit;
            return (
              <tr key={test.loinc} style={{ background: selected ? '#eaf3fb' : undefined }}>
                <td
                  {...pressable((e) => {
                    onSelect(test.loinc);
                    onOpenPopup(test, e);
                  })}
                  style={{ ...td, width: LABEL_COL_WIDTH }}
                >
                  <span style={{ fontWeight: 600 }}>{test.short}</span>
                  {displayUnit && `, ${displayUnit}`}
                </td>
                <ObservationCells {...props} test={test} selected={selected} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function IndexTable({
  defs, visibleDates, resultsByDate, selectedLoinc, onSelect, onOpenPopup,
}: Readonly<{
  defs: IndexDef[];
  visibleDates: string[];
  resultsByDate: Record<string, Record<string, Result>>;
  selectedLoinc: string | null;
  onSelect: (key: string) => void;
  onOpenPopup: (def: IndexDef, e: { currentTarget: HTMLElement }) => void;
}>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <TableHead label="Indices" dates={visibleDates} />
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
                  <span style={{ fontWeight: 600 }}>{def.nameCompact}</span>
                  {def.unit && `, ${def.unit}`}
                </td>
                {visibleDates.map((date) => {
                  const value = computeIndex(def, resultsByDate[date] ?? {});
                  if (value == null) {
                    return (
                      <td key={date} {...pressable(() => onSelect(def.key))} style={td}>
                        –
                      </td>
                    );
                  }
                  const z = zone(value, def.cut[0], def.cut[1], def.hi);
                  return (
                    <td key={date} {...pressable(() => onSelect(def.key))} style={{ ...td, background: selected ? SELECTED_ZONE_BG[z] : ZONE_BG[z] }}>
                      {fmtNum(value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
