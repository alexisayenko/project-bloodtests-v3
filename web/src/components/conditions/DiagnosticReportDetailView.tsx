import { useEffect, useMemo, useState } from 'react';
import type { Result, DiagnosticReport } from '../../types';
import { fmtNum } from '../../utils/format';
import { validateDiagnosticReports, hasErrors as hasValidationErrors, groupHasErrors } from '../../data/validateDiagnosticReports';
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
  const [loadedItems, setLoadedItems] = useState<Result[] | null>(null);
  const [draftItems, setDraftItems] = useState<Result[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}></th>
                  <th style={th}>Test name</th>
                  <th style={th}>Symbol</th>
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
                  return (
                    <tr key={`${item.loinc}-${i}`}>
                      <td style={td}>
                        {itemHasError && (
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea4335' }} title="Error" />
                        )}
                      </td>
                      <td style={td}>{item.analysis}</td>
                      <td style={td}>{item.symbol}</td>
                      <td style={td}>
                        <input
                          type="text"
                          value={item.loinc}
                          onChange={(e) => handleEditItem(i, 'loinc', e.currentTarget.value)}
                          onBlur={() => {}}
                          style={{ width: '100%', border: '1px solid #ccc', padding: '2px 4px', fontSize: 13 }}
                        />
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
