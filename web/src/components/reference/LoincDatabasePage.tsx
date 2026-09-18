import { useMemo, useState } from 'react';
import { formatMonthYear } from '../../data/months';
import { useData } from '../../data/DataContext';
import { ALSO_REFS, ANALYTES, ANALYTE_BY_LOINC, SHORT_NAMES, SPECIMENS, trimmedLongName } from '../../data/analyteCatalog';
import { COLOR } from '../../styles/tokens';
import type { Analysis } from '../../types';
import { sortAnalytes, type AnalyteSortKey, type AnalyteSortValues, type SortDirection } from '../conditions/analyteSort';
import {
  buildConditions,
  buildPanelsByLoinc,
  observationMatchesQuery,
  panelMembershipOf,
  type Observation,
} from '../conditions/markers';
import { latestEntryByLoinc, type ResultEntry } from '../conditions/resultsLookup';
import { routeToHash, type Route } from '../conditions/routing';
import { namedLab } from '../conditions/resultCells';
import { TABLE, pressable } from '../primitives/styles';
import { td, th, wrapTd } from './cells';
import { EM_DASH, LoincLink } from './parts';

const FILTER_INPUT = {
  border: `1.5px solid ${COLOR.accent}`,
  borderRadius: 9999,
  padding: '4px 12px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  lineHeight: '18px',
  color: COLOR.accent,
  backgroundColor: 'transparent',
  width: 260,
  maxWidth: '100%',
  outline: 'none',
} as const;

// Under table-layout: auto, width caps the column only with overflow-wrap: anywhere, whose near-zero
// min-content then needs the min-width so a squeezed table cannot crush it.
const LONG_NAME_WIDTH = 340;
const longNameTd = {
  ...wrapTd,
  minWidth: 260,
  width: LONG_NAME_WIDTH,
  maxWidth: LONG_NAME_WIDTH,
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
} as const;

// The LOINC name under a code: muted and a size down, so the code stays the line you scan.
const loincNameLine = { color: COLOR.textMuted, fontSize: 12, lineHeight: '16px', marginTop: 2 } as const;

const nameTd = { ...wrapTd, minWidth: 160 } as const;

const sortableTh = { ...th, padding: 0 } as const;

// The span carries the padding so the whole header cell is the tap target.
const sortableLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 12px',
  cursor: 'pointer',
  userSelect: 'none',
} as const;

const ARROW = { asc: '▲', desc: '▼' } as const;
const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

function SortableHeader({
  label,
  column,
  sort,
  onSort,
}: Readonly<{
  label: string;
  column: AnalyteSortKey;
  sort: { key: AnalyteSortKey; direction: SortDirection };
  onSort: (key: AnalyteSortKey) => void;
}>) {
  const active = sort.key === column;
  return (
    <th style={sortableTh} aria-sort={active ? ARIA_SORT[sort.direction] : 'none'}>
      <span
        {...pressable(() => onSort(column))}
        aria-label={`Sort by ${label}`}
        style={{ ...sortableLabel, color: active ? COLOR.accent : COLOR.textSecondary }}
      >
        {label}
        <span aria-hidden style={{ fontSize: 9, color: active ? COLOR.accent : COLOR.textDisabled }}>
          {active ? ARROW[sort.direction] : '↕'}
        </span>
      </span>
    </th>
  );
}

/** A real anchor, but navigation goes through the router: the shell does not listen for `hashchange`. */
function PanelLinks({ panels, navigate }: Readonly<{ panels: string[]; navigate: (r: Route) => void }>) {
  return (
    <>
      {panels.map((name, i) => (
        <span key={name}>
          {i > 0 && ' · '}
          <a
            href={routeToHash({ view: 'panel', name })}
            onClick={(e) => {
              e.preventDefault();
              navigate({ view: 'panel', name });
            }}
            style={{ color: COLOR.accent }}
          >
            {name}
          </a>
        </span>
      ))}
    </>
  );
}

function PanelsCell({
  membership,
  navigate,
}: Readonly<{ membership: { panels: string[]; via?: string }; navigate: (r: Route) => void }>) {
  if (!membership.panels.length) return <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>;
  if (!membership.via) return <PanelLinks panels={membership.panels} navigate={navigate} />;
  return (
    <span style={{ color: COLOR.textSecondary }} title={`This code is a variant of ${membership.via}; a reading recorded under it is shown in that marker's row.`}>
      <PanelLinks panels={membership.panels} navigate={navigate} />
      <span style={{ color: COLOR.textMuted }}> · via <LoincLink loinc={membership.via} /></span>
    </span>
  );
}

const labLine = {
  maxWidth: 180,
  fontSize: 11,
  lineHeight: '14px',
  color: COLOR.textMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** "2026-08-19" at "MS LAB Diagnostics" → "Aug 26" over a muted "MS LAB Diagnostics". */
function LastTestedCell({ entry }: Readonly<{ entry?: ResultEntry }>) {
  if (!entry) return <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>;
  const lab = namedLab(entry.place);
  return (
    <>
      {formatMonthYear(entry.date)}
      {lab && (
        <div style={labLine} title={lab}>
          {lab}
        </div>
      )}
    </>
  );
}

function UnitsCell({ analyte }: Readonly<{ analyte: Analysis }>) {
  if (!analyte.unit) return <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>;
  return (
    <>
      <span style={{ fontFamily: 'monospace' }}>{analyte.unit}</span>
      {analyte.allowedUnits?.length && (
        <span style={{ color: COLOR.textMuted, fontFamily: 'monospace' }}> · {analyte.allowedUnits.join(' · ')}</span>
      )}
    </>
  );
}

export function LoincDatabasePage({
  allResults,
  navigate,
}: Readonly<{ allResults?: readonly ResultEntry[]; navigate: (r: Route) => void }>) {
  const { panels, monitoringPanels } = useData();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: AnalyteSortKey; direction: SortDirection }>({ key: 'friendlyName', direction: 'asc' });

  // Exact code, no alias folding: the column answers "which code did my lab print".
  const lastTested = useMemo(() => latestEntryByLoinc(allResults ?? []), [allResults]);

  const rows = useMemo(() => {
    const panelsByLoinc = buildPanelsByLoinc(buildConditions(panels, ANALYTE_BY_LOINC, monitoringPanels));
    return ANALYTES.map((analyte) => {
      const trimmedName = trimmedLongName(analyte.longCommonName);
      const shortName = SHORT_NAMES[analyte.loinc]?.shortName;
      const latest = lastTested[analyte.loinc];
      return {
        analyte,
        membership: panelMembershipOf(panelsByLoinc, analyte.loinc),
        trimmedName,
        shortName,
        latest,
        sortValues: {
          loinc: analyte.loinc,
          friendlyName: analyte.friendlyName,
          specimen: SPECIMENS[analyte.loinc],
          unit: analyte.unit,
          lastTested: latest?.date,
        } satisfies AnalyteSortValues,
        observation: {
          shortName: shortName ?? analyte.friendlyName,
          friendlyName: analyte.friendlyName,
          longCommonName: analyte.longCommonName,
          loinc: analyte.loinc,
          also: ALSO_REFS[analyte.loinc],
        } satisfies Observation,
      };
    });
  }, [panels, monitoringPanels, lastTested]);

  // Catalog translations stand in for printed names, so a Cyrillic name still finds its row.
  const primaryCount = useMemo(() => ANALYTES.filter((a) => !a.aliasOf).length, []);

  const matched = rows.filter((row) => observationMatchesQuery(row.observation, query, Object.values(row.analyte.lang)));
  const shown = sortAnalytes(matched, (row) => row.sortValues, sort.key, sort.direction);

  const toggle = (key: AnalyteSortKey) =>
    setSort((current) =>
      current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
    );

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>LOINC database</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 20, maxWidth: 720 }}>
        Every analyte the app knows, as the catalog defines it. The specimen is read out of each LOINC name; where
        a name does not state one, nothing is shown rather than a guess. The LOINC name under each code drops that
        clause and the property bracket, both having columns of their own — hover it for the official string.
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLOR.textMuted, marginBottom: 6 }}>Find a marker</div>
        <input
          type="search"
          aria-label="Filter the LOINC database by name or code"
          placeholder="HGB, Hemoglobin, 718-7…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          style={FILTER_INPUT}
        />
      </div>
      <div style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 14 }}>
        {/* A row is a code, not an analyte: a code fixes the property and specimen too, so
            cholesterol occupies two. The second figure counts the primaries the aliases fold into. */}
        {shown.length === rows.length
          ? `${rows.length} codes · ${primaryCount} analytes`
          : `${shown.length} of ${rows.length} codes · ${primaryCount} analytes`}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <SortableHeader label="LOINC" column="loinc" sort={sort} onSort={toggle} />
              <SortableHeader label="Name" column="friendlyName" sort={sort} onSort={toggle} />
              <SortableHeader label="Specimen" column="specimen" sort={sort} onSort={toggle} />
              <SortableHeader label="Units" column="unit" sort={sort} onSort={toggle} />
              <SortableHeader label="Last tested" column="lastTested" sort={sort} onSort={toggle} />
              <th style={th} title="A code can belong to several panels, or to none, so there is no one order to put them in.">
                Panels
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ analyte, membership, trimmedName, shortName, latest }) => (
              <tr key={analyte.loinc}>
                <td style={longNameTd}>
                  <LoincLink loinc={analyte.loinc} />
                  <div style={loincNameLine} title={analyte.longCommonName}>
                    {trimmedName}
                  </div>
                </td>
                <td style={nameTd}>
                  {analyte.friendlyName}
                  {shortName && shortName !== analyte.friendlyName && (
                    <div style={{ color: COLOR.textMuted }}>{shortName}</div>
                  )}
                </td>
                <td style={td}>
                  {SPECIMENS[analyte.loinc] ?? <span style={{ color: COLOR.textMuted }}>{EM_DASH}</span>}
                </td>
                <td style={td}>
                  <UnitsCell analyte={analyte} />
                </td>
                <td style={td}>
                  <LastTestedCell entry={latest} />
                </td>
                <td style={{ ...wrapTd, minWidth: 180 }}>
                  <PanelsCell membership={membership} navigate={navigate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
