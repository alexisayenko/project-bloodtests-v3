import { useEffect, useMemo, useState } from 'react';
import type { Result, DiagnosticReport } from '../../types';
import { fmtNum } from '../../utils/format';
import { validateDiagnosticReports, groupHasErrors } from '../../data/validateDiagnosticReports';
import { useData } from '../../data/DataContext';
import {
  crossCheckLocal,
  fetchNlmLoinc,
  latinPart,
  tokenOverlap,
  type CrossCheckResult,
  type NlmEntry,
} from '../../data/loincCheck';
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
  const items = draftItems ?? group?.items ?? loadedItems;

  const allGroups = useMemo<DiagnosticReport[]>(() => (group ? [group] : []), [group]);
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

  const handleEditItem = (index: number, field: 'loinc' | 'value' | 'unit', newValue: string) => {
    if (!items) return;
    const updated = [...items];
    const item = { ...updated[index]! };
    if (field === 'loinc') item.loinc = newValue;
    if (field === 'value') {
      const numVal = parseFloat(newValue);
      item.value = isNaN(numVal) ? null : numVal;
      item.rawValue = newValue;
    }
    if (field === 'unit') item.unit = newValue;
    updated[index] = item;
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

  const handleCrossCheck = () => {
    if (!items) return;
    setCheckResults(crossCheckLocal(items, Object.values(analysesCatalog)));
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
      .filter(
        ({ r, i }) =>
          (r.status === 'unknown-code' && nlmByCode[items[i]!.loinc] == null) ||
          (r.status === 'no-code' && !r.suggestions?.length && !nlmSuggestions[i]?.length)
      );
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
    const perRow: Record<number, NlmEntry[]> = {};
    for (const { r, i } of unresolvedRows) {
      if (r.status !== 'no-code') continue;
      const found = result.byName[latinPart(items[i]!.analysis)];
      if (found?.length) perRow[i] = found;
    }
    setNlmSuggestions(perRow);
    setNlmState(result.status === 'ok' ? 'done' : 'failed');
  };

  // Resolved official name for a row, from the local catalog or the NLM lookup.
  const resolvedNameOf = (item: Result, check: CrossCheckResult | undefined): string | undefined => {
    if (!check) return undefined;
    if (check.loincName) return check.loincName;
    if (check.status === 'unknown-code') return nlmByCode[item.loinc] ?? undefined;
    return undefined;
  };

  return (
    <>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 600, marginBottom: 24 }}>
        <span {...pressable(onBack)} style={{ color: '#1971c2', cursor: 'pointer' }}>
          ‹
        </span>
        {group ? `${group.place} · ${formatFullDate(group.date)}` : 'Diagnostic Report'}
      </h1>
      {errorCount > 0 || warningCount > 0 ? (
        <div style={{ fontSize: 13, marginBottom: 16 }}>
          <div style={{ color: '#666', marginBottom: 8 }}>
            {errorCount > 0 && <span style={{ color: '#ea4335', fontWeight: 600 }}>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
            {errorCount > 0 && warningCount > 0 && <span>, </span>}
            {warningCount > 0 && <span style={{ color: '#fbbc04', fontWeight: 600 }}>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
          </div>
          {issues.filter((i) => i.groupFile === group?.file && i.level === 'error').length > 0 && (
            <div style={{ color: '#ea4335', marginBottom: 8 }}>
              {issues
                .filter((i) => i.groupFile === group?.file && i.level === 'error')
                .map((issue, idx) => (
                  <div key={idx} style={{ fontSize: 12 }}>
                    Row {issue.resultIndex! + 1}: {issue.message}
                  </div>
                ))}
            </div>
          )}
          {issues.filter((i) => i.groupFile === group?.file && i.level === 'warning').length > 0 && (
            <div style={{ color: '#fbbc04' }}>
              {issues
                .filter((i) => i.groupFile === group?.file && i.level === 'warning')
                .map((issue, idx) => (
                  <div key={idx} style={{ fontSize: 12 }}>
                    Row {issue.resultIndex! + 1}: {issue.message}
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#34a853', marginBottom: 16 }}>No issues</div>
      )}
      {!items || items.length === 0 ? (
        <div style={{ color: '#888', fontSize: 14 }}>No results recorded on this report.</div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={handleCrossCheck}
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
                  const check = checkResults?.[i];
                  const resolvedName = resolvedNameOf(item, check);
                  const nlmResolvedName = check?.status === 'unknown-code' ? nlmByCode[item.loinc] : undefined;
                  const nlmNameMatches =
                    nlmResolvedName != null && tokenOverlap(latinPart(item.analysis), nlmResolvedName) >= 0.2;
                  const chipSuggestions =
                    check?.status === 'no-code'
                      ? check.suggestions?.length
                        ? check.suggestions
                        : (nlmSuggestions[i] ?? [])
                      : [];
                  return (
                    <tr key={`${item.loinc}-${i}`}>
                      <td style={td}>
                        {itemHasError && (
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea4335' }} title="Error" />
                        )}
                      </td>
                      <td style={td}>
                        {item.analysis}
                        {resolvedName && (
                          <div style={{ fontSize: 11, color: '#888' }}>{resolvedName}</div>
                        )}
                      </td>
                      <td style={td}>
                        <input
                          type="text"
                          value={item.loinc}
                          onChange={(e) => handleEditItem(i, 'loinc', e.currentTarget.value)}
                          onBlur={() => {}}
                          style={{ width: '100%', border: '1px solid #ccc', padding: '2px 4px', fontSize: 13 }}
                        />
                        {check?.status === 'match' && (
                          <div style={{ fontSize: 11, color: '#34a853' }}>✓ matches {check.loincName}</div>
                        )}
                        {check?.status === 'mismatch' && (
                          <div style={{ fontSize: 11, color: '#f59f00' }}>
                            ⚠ code is {check.loincName} — printed name differs
                          </div>
                        )}
                        {check?.status === 'malformed' && (
                          <div style={{ fontSize: 11, color: '#ea4335' }}>✗ not a LOINC code</div>
                        )}
                        {check?.status === 'unknown-code' &&
                          (nlmResolvedName != null ? (
                            nlmNameMatches ? (
                              <div style={{ fontSize: 11, color: '#34a853' }}>✓ matches {nlmResolvedName}</div>
                            ) : (
                              <div style={{ fontSize: 11, color: '#f59f00' }}>
                                ⚠ code is {nlmResolvedName} — printed name differs
                              </div>
                            )
                          ) : (
                            <div style={{ fontSize: 11, color: '#ea4335' }}>✗ unknown code</div>
                          ))}
                        {check?.status === 'no-code' && chipSuggestions.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {chipSuggestions.map((s) => (
                              <span
                                key={s.loinc}
                                {...pressable(() => handleEditItem(i, 'loinc', s.loinc))}
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
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <input
                          type="text"
                          value={item.rawValue || (item.value != null ? String(item.value) : '')}
                          onChange={(e) => handleEditItem(i, 'value', e.currentTarget.value)}
                          onBlur={() => {}}
                          style={{ width: '100%', border: '1px solid #ccc', padding: '2px 4px', fontSize: 13 }}
                        />
                      </td>
                      <td style={td}>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleEditItem(i, 'unit', e.currentTarget.value)}
                          onBlur={() => {}}
                          style={{ width: '100%', border: '1px solid #ccc', padding: '2px 4px', fontSize: 13 }}
                        />
                      </td>
                      <td style={td}>{referenceRangeOf(item)}</td>
                      <td style={td}>{item.method}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {checkResults && unresolvedRows.length > 0 && nlmState !== 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16, fontSize: 13 }}>
              <span style={{ color: '#666' }}>
                {unresolvedRows.length} observation{unresolvedRows.length !== 1 ? 's' : ''} unresolved —
              </span>
              <button
                onClick={handleNlmCheck}
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
          {draftItems && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleSave}
                disabled={isSaving || hasErrors}
                style={{
                  padding: '8px 16px',
                  backgroundColor: hasErrors ? '#ccc' : '#1971c2',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: hasErrors ? 'not-allowed' : 'pointer',
                  opacity: hasErrors ? 0.5 : 1,
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
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
      )}
    </>
  );
}
