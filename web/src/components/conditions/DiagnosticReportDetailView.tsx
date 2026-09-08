import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Analysis, Result, DiagnosticReport } from '../../types';
import { fmtNum } from '../../utils/format';
import {
  validateDiagnosticReports,
  groupHasErrors,
  type ValidationIssue,
} from '../../data/validateDiagnosticReports';
import { useData } from '../../data/DataContext';
import {
  crossCheckLocal,
  fetchNlmLoinc,
  latinPart,
  selectByUnit,
  type CrossCheckResult,
  type CrossCheckSuggestion,
  type NlmEntry,
} from '../../data/loincCheck';
import { ALSO_REFS, ALIAS_TO_PRIMARY } from './markers';
import { formatFullDate, pressable } from './ui';

const th = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1.5px solid #1971c2',
  whiteSpace: 'nowrap',
} as const;
const td = { padding: '8px 12px', borderBottom: '1px solid #eee' } as const;

function referenceRangeOf(item: Result): string {
  if (item.refText) return item.refText;
  if (item.refMin != null && item.refMax != null) return `${fmtNum(item.refMin)} - ${fmtNum(item.refMax)}`;
  return '';
}

function pluralize(n: number): string {
  return n === 1 ? '' : 's';
}

type EditableField = 'loinc' | 'value' | 'unit';

function applyFieldEdit(item: Result, field: EditableField, newValue: string): Result {
  if (field === 'loinc') return { ...item, loinc: newValue };
  if (field === 'unit') return { ...item, unit: newValue };
  const numVal = Number.parseFloat(newValue);
  return { ...item, value: Number.isNaN(numVal) ? null : numVal, rawValue: newValue };
}

// A confident derivation is applied immediately (draft-gated by Save/Cancel)
// — the user shouldn't have to pick between codes the resolver already
// decided between.
function computeConfidentFixes(items: Result[], results: CrossCheckResult[]): Map<number, string> {
  const fixes = new Map<number, string>();
  results.forEach((r, i) => {
    const top = r.suggestions?.[0];
    if (r.confident && top && top.loinc !== items[i]!.loinc.trim()) fixes.set(i, top.loinc);
  });
  return fixes;
}

function applyFixes(items: Result[], fixes: Map<number, string>): Result[] {
  return items.map((item, i) => {
    const fix = fixes.get(i);
    return fix ? { ...item, loinc: fix } : item;
  });
}

function isRowUnresolved(
  r: CrossCheckResult,
  i: number,
  items: Result[],
  nlmByCode: Record<string, string | null>,
  nlmSuggestions: Record<number, NlmEntry[]>
): boolean {
  if (r.status === 'unknown-code') return nlmByCode[items[i]!.loinc] == null;
  if (r.status === 'no-code') return !r.suggestions?.length && !nlmSuggestions[i]?.length;
  return false;
}

function buildNlmSuggestionsByRow(
  unresolvedRows: { r: CrossCheckResult; i: number }[],
  items: Result[],
  byName: Record<string, NlmEntry[]>
): Record<number, NlmEntry[]> {
  const perRow: Record<number, NlmEntry[]> = {};
  for (const { r, i } of unresolvedRows) {
    if (r.status !== 'no-code') continue;
    const found = byName[latinPart(items[i]!.analysis)];
    if (found?.length) perRow[i] = selectByUnit(found, items[i]!.unit).slice(0, 3);
  }
  return perRow;
}

// Resolved official name for a row, from the local catalog or the NLM lookup.
function resolvedNameOf(
  item: Result,
  check: CrossCheckResult | undefined,
  nlmByCode: Record<string, string | null>
): string | undefined {
  if (!check) return undefined;
  if (check.loincName) return check.loincName;
  if (check.status === 'unknown-code') return nlmByCode[item.loinc] ?? undefined;
  return undefined;
}

// Catalog expanded with unit-variant aliases (ALSO_REFS): labs report
// e.g. SHBG as 13967-5 (nmol/L) while the catalog keys it as 2942-1.
function buildExpandedCatalog(analysesCatalog: Record<string, Analysis>): Analysis[] {
  const base = Object.values(analysesCatalog);
  const byCode = new Map(base.map((a) => [a.loinc, a]));
  const aliases = Object.entries(ALSO_REFS).flatMap(([primary, refs]) => {
    const canonical = byCode.get(primary);
    if (!canonical) return [];
    return refs
      .filter((r) => !byCode.has(r.loinc))
      .map((r) => ({ ...canonical, loinc: r.loinc, longCommonName: r.longCommonName }));
  });
  return [...base, ...aliases];
}

function getMismatchMessage(
  item: Result,
  check: CrossCheckResult | undefined,
  nameMismatch: boolean
): string | null {
  if (!nameMismatch || !check) return null;
  if (!check.derived) return 'Printed name differs from the LOINC name';
  const loincNameSuffix = check.loincName ? ` is ${check.loincName}` : '';
  return `printed code ${item.loinc.trim()}${loincNameSuffix} — name+unit resolve to ${check.derived.loinc} ${check.derived.name}`;
}

function getDotColor(itemHasError: boolean, itemHasWarning: boolean, nameMismatch: boolean): string {
  if (itemHasError) return '#ea4335';
  if (itemHasWarning || nameMismatch) return '#fbbc04';
  return '#34a853';
}

function getDotTitle(itemIssues: ValidationIssue[], mismatchMsg: string | null): string {
  const messages = itemIssues.map((issue) => issue.message);
  if (mismatchMsg) messages.push(mismatchMsg);
  return messages.join('; ') || 'OK';
}

type SuggestionChip = CrossCheckSuggestion | NlmEntry;

function getChipSuggestions(
  check: CrossCheckResult | undefined,
  rowNlmSuggestions: NlmEntry[] | undefined
): SuggestionChip[] {
  if (!check) return [];
  const isResolvableStatus = check.status === 'no-code' || check.status === 'malformed' || check.status === 'mismatch';
  if (!isResolvableStatus) return [];
  if (check.suggestions?.length) return check.suggestions;
  return rowNlmSuggestions ?? [];
}

// Show the unit only where it disambiguates: on a known unit-variant code,
// or when two chips share a name.
function getUnitLabel(suggestion: SuggestionChip, chipSuggestions: SuggestionChip[]): string {
  if (!suggestion.unit) return '';
  const disambiguates =
    suggestion.loinc in ALIAS_TO_PRIMARY ||
    suggestion.loinc in ALSO_REFS ||
    chipSuggestions.some((o) => o !== suggestion && o.name === suggestion.name);
  return disambiguates ? ` · ${suggestion.unit}` : '';
}

function saveButtonStyle(hasErrors: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    backgroundColor: hasErrors ? '#ccc' : '#1971c2',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    cursor: hasErrors ? 'not-allowed' : 'pointer',
    opacity: hasErrors ? 0.5 : 1,
  };
}

function saveButtonLabel(isSaving: boolean): string {
  return isSaving ? 'Saving...' : 'Save';
}

interface ReportResultsSectionProps {
  items: Result[];
  group: DiagnosticReport | undefined;
  issues: ValidationIssue[];
  checkResults: CrossCheckResult[] | null;
  nlmState: 'idle' | 'loading' | 'done' | 'failed';
  nlmByCode: Record<string, string | null>;
  nlmSuggestions: Record<number, NlmEntry[]>;
  autoFilledCount: number;
  unresolvedRows: { r: CrossCheckResult; i: number }[];
  errorCount: number;
  warningCount: number;
  hasErrors: boolean;
  draftItems: Result[] | null;
  isSaving: boolean;
  onCrossCheck: () => void;
  onNlmCheck: () => void;
  onEditItem: (index: number, field: EditableField, newValue: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ReportResultsSection({
  items,
  group,
  issues,
  checkResults,
  nlmState,
  nlmByCode,
  nlmSuggestions,
  autoFilledCount,
  unresolvedRows,
  errorCount,
  warningCount,
  hasErrors,
  draftItems,
  isSaving,
  onCrossCheck,
  onNlmCheck,
  onEditItem,
  onSave,
  onCancel,
}: Readonly<ReportResultsSectionProps>) {
  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <button
          onClick={onCrossCheck}
          style={{
            padding: '6px 16px',
            backgroundColor: 'transparent',
            color: '#1971c2',
            border: '1.5px solid #1971c2',
            borderRadius: 999,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cross-check LOINCs
        </button>
        {autoFilledCount > 0 && (
          <span style={{ fontSize: 13, color: '#34a853' }}>
            ✓ {autoFilledCount} code{pluralize(autoFilledCount)} filled automatically — review and Save
          </span>
        )}
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}></th>
              <th style={th}>Test name</th>
              <th style={th}>LOINC</th>
              <th style={th}>Value</th>
              <th style={th}>Unit</th>
              <th style={th}>Reference range</th>
              <th style={th}>Method</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const itemIssues = issues.filter((issue) => issue.groupFile === group?.file && issue.resultIndex === i);
              const itemHasError = itemIssues.some((issue) => issue.level === 'error');
              const itemHasWarning = itemIssues.some((issue) => issue.level === 'warning');
              const check = checkResults?.[i];
              const nameMismatch = check?.status === 'mismatch';
              const mismatchMsg = getMismatchMessage(item, check, nameMismatch);
              const dotColor = getDotColor(itemHasError, itemHasWarning, nameMismatch);
              const dotTitle = getDotTitle(itemIssues, mismatchMsg);
              const resolvedName = resolvedNameOf(item, check, nlmByCode);
              const nlmResolvedName = check?.status === 'unknown-code' ? nlmByCode[item.loinc] : undefined;
              const chipSuggestions = getChipSuggestions(check, nlmSuggestions[i]);
              const linkedName = resolvedName ?? nlmResolvedName;
              return (
                <Fragment key={`${item.loinc}-${i}`}>
                  <tr>
                    <td style={td}>
                      <span
                        style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor }}
                        title={dotTitle}
                      />
                    </td>
                    <td style={td}>{item.analysis}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          value={item.loinc}
                          onChange={(e) => onEditItem(i, 'loinc', e.currentTarget.value)}
                          onBlur={() => {}}
                          style={{ width: 80, border: '1px solid #ccc', padding: '2px 4px', fontSize: 13 }}
                        />
                        {linkedName && (
                          <a
                            href={`https://loinc.org/${item.loinc}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 13, color: '#1971c2', whiteSpace: 'nowrap', textDecoration: 'none' }}
                          >
                            {linkedName}
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={td}>
                      <input
                        type="text"
                        value={item.rawValue || (item.value != null ? String(item.value) : '')}
                        onChange={(e) => onEditItem(i, 'value', e.currentTarget.value)}
                        onBlur={() => {}}
                        style={{ width: 70, border: '1px solid #ccc', padding: '2px 4px', fontSize: 13 }}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => onEditItem(i, 'unit', e.currentTarget.value)}
                        onBlur={() => {}}
                        style={{ width: 80, border: '1px solid #ccc', padding: '2px 4px', fontSize: 13 }}
                      />
                    </td>
                    <td style={td}>{referenceRangeOf(item)}</td>
                    <td style={td}>{item.method}</td>
                  </tr>
                  {!itemHasError && (itemHasWarning || nameMismatch) && (
                    <tr>
                      <td colSpan={7} style={{ ...td, paddingTop: 0, fontSize: 12, color: '#b8860b' }}>
                        {[
                          ...itemIssues.filter((issue) => issue.level === 'warning').map((issue) => issue.message),
                          ...(mismatchMsg ? [mismatchMsg] : []),
                        ].join(' · ')}
                      </td>
                    </tr>
                  )}
                  {chipSuggestions.length > 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...td, paddingTop: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {chipSuggestions.map((s) => {
                            const unitLabel = getUnitLabel(s, chipSuggestions);
                            return (
                              <span
                                key={s.loinc}
                                {...pressable(() => onEditItem(i, 'loinc', s.loinc))}
                                title={s.name}
                                style={{
                                  fontSize: 11,
                                  color: '#1971c2',
                                  border: '1px solid #1971c2',
                                  borderRadius: 999,
                                  padding: '1px 8px',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {s.loinc} {s.name}
                                {unitLabel}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {checkResults && unresolvedRows.length > 0 && nlmState !== 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: '#666' }}>
            {unresolvedRows.length} observation{pluralize(unresolvedRows.length)} unresolved —
          </span>
          <button
            onClick={onNlmCheck}
            style={{
              padding: '4px 12px',
              backgroundColor: 'transparent',
              color: '#1971c2',
              border: '1.5px solid #1971c2',
              borderRadius: 999,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Check online (NLM)
          </button>
          <span style={{ fontSize: 11, color: '#888' }}>
            sends test names to clinicaltables.nlm.nih.gov, never values
          </span>
        </div>
      )}
      {nlmState === 'loading' && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>Checking against NLM…</div>
      )}
      {nlmState === 'failed' && (
        <div style={{ fontSize: 12, color: '#ea4335', marginBottom: 16 }}>
          NLM lookup failed — check your network and try again.
        </div>
      )}
      {(errorCount > 0 || warningCount > 0) && (
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          {errorCount > 0 && (
            <span style={{ color: '#ea4335', fontWeight: 600 }}>
              {errorCount} error{pluralize(errorCount)}
            </span>
          )}
          {errorCount > 0 && warningCount > 0 && <span>, </span>}
          {warningCount > 0 && (
            <span style={{ color: '#fbbc04', fontWeight: 600 }}>
              {warningCount} warning{pluralize(warningCount)}
            </span>
          )}
        </div>
      )}
      {draftItems && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onSave} disabled={isSaving || hasErrors} style={saveButtonStyle(hasErrors)}>
            {saveButtonLabel(isSaving)}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}

export function DiagnosticReportDetailView({
  group,
  loadGroupItems,
  onBack,
  onUpdateGroup,
}: Readonly<{
  group: DiagnosticReport | undefined;
  loadGroupItems: (sessionId: string) => Promise<Result[]>;
  onBack: () => void;
  onUpdateGroup?: (file: string, updatedGroup: DiagnosticReport) => void;
}>) {
  const { analysesCatalog } = useData();
  const [loadedItems, setLoadedItems] = useState<Result[] | null>(null);
  const [draftItems, setDraftItems] = useState<Result[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [checkResults, setCheckResults] = useState<CrossCheckResult[] | null>(null);
  const [nlmState, setNlmState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const [nlmByCode, setNlmByCode] = useState<Record<string, string | null>>({});
  const [nlmSuggestions, setNlmSuggestions] = useState<Record<number, NlmEntry[]>>({});
  const [autoFilledCount, setAutoFilledCount] = useState(0);
  const items = draftItems ?? group?.items ?? loadedItems;

  // Validate what's on screen: the draft while editing, the stored group otherwise.
  const allGroups = useMemo<DiagnosticReport[]>(
    () => (group ? [{ ...group, items: items ?? group.items }] : []),
    [group, items]
  );
  const issues = useMemo(() => validateDiagnosticReports(allGroups), [allGroups]);
  const hasErrors = groupHasErrors(group?.file ?? '', issues);

  const errorCount = useMemo(
    () => issues.filter((i) => i.groupFile === group?.file && i.level === 'error').length,
    [issues, group?.file]
  );
  const warningCount = useMemo(
    () => issues.filter((i) => i.groupFile === group?.file && i.level === 'warning').length,
    [issues, group?.file]
  );

  useEffect(() => {
    if (!group || group.items) return;
    let cancelled = false;
    loadGroupItems(group.file).then((loaded) => {
      if (!cancelled) setLoadedItems(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [group, loadGroupItems]);

  const handleEditItem = (index: number, field: EditableField, newValue: string) => {
    if (!items) return;
    const updated = [...items];
    updated[index] = applyFieldEdit(updated[index]!, field, newValue);
    setDraftItems(updated);
  };

  const handleSave = async () => {
    if (!group || !draftItems || !onUpdateGroup) return;
    setIsSaving(true);
    try {
      onUpdateGroup(group.file, { ...group, items: draftItems });
      setDraftItems(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraftItems(null);
  };

  const expandedCatalog = useMemo(() => buildExpandedCatalog(analysesCatalog), [analysesCatalog]);

  const handleCrossCheck = () => {
    if (!items) return;
    const results = crossCheckLocal(items, expandedCatalog);
    const fixes = computeConfidentFixes(items, results);
    if (fixes.size > 0) {
      const updated = applyFixes(items, fixes);
      setDraftItems(updated);
      setCheckResults(crossCheckLocal(updated, expandedCatalog));
      setAutoFilledCount(fixes.size);
    } else {
      setCheckResults(results);
      setAutoFilledCount(0);
    }
    setNlmState('idle');
    setNlmByCode({});
    setNlmSuggestions({});
  };

  // Rows the local pass couldn't resolve: unknown codes, or codeless rows
  // with no local suggestion.
  const unresolvedRows = useMemo(() => {
    if (!checkResults || !items) return [];
    return checkResults
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => isRowUnresolved(r, i, items, nlmByCode, nlmSuggestions));
  }, [checkResults, items, nlmByCode, nlmSuggestions]);

  const handleNlmCheck = async () => {
    if (!items || !checkResults) return;
    setNlmState('loading');
    const codes = unresolvedRows.filter(({ r }) => r.status === 'unknown-code').map(({ i }) => items[i]!.loinc);
    const names = unresolvedRows
      .filter(({ r }) => r.status === 'no-code')
      .map(({ i }) => latinPart(items[i]!.analysis))
      .filter((n) => n !== '');
    const result = await fetchNlmLoinc([...new Set(codes)], [...new Set(names)]);
    setNlmByCode(result.byCode);
    setNlmSuggestions(buildNlmSuggestionsByRow(unresolvedRows, items, result.byName));
    setNlmState(result.status === 'ok' ? 'done' : 'failed');
  };

  return (
    <>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 600, marginBottom: 24 }}>
        <span {...pressable(onBack)} style={{ color: '#1971c2', cursor: 'pointer' }}>
          ‹
        </span>
        {group ? `${group.place} · ${formatFullDate(group.date)}` : 'Diagnostic Report'}
      </h1>
      {!items || items.length === 0 ? (
        <div style={{ color: '#888', fontSize: 14 }}>No results recorded on this report.</div>
      ) : (
        <ReportResultsSection
          items={items}
          group={group}
          issues={issues}
          checkResults={checkResults}
          nlmState={nlmState}
          nlmByCode={nlmByCode}
          nlmSuggestions={nlmSuggestions}
          autoFilledCount={autoFilledCount}
          unresolvedRows={unresolvedRows}
          errorCount={errorCount}
          warningCount={warningCount}
          hasErrors={hasErrors}
          draftItems={draftItems}
          isSaving={isSaving}
          onCrossCheck={handleCrossCheck}
          onNlmCheck={handleNlmCheck}
          onEditItem={handleEditItem}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
