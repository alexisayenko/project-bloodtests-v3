import { useMemo, useState } from 'react';
import type { DiagnosticReport } from '../../types';
import { validateDiagnosticReports, groupHasErrors, groupHasWarnings } from '../../data/validateDiagnosticReports';
import { formatFullDate, pressable } from './ui';
import { exportData } from '../../utils/exportData';

const th = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1.5px solid #1971c2',
  whiteSpace: 'nowrap',
} as const;
const td = { padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' } as const;

export function DiagnosticReportsView({
  sessions,
  onOpenDetail,
}: Readonly<{
  sessions: DiagnosticReport[];
  onOpenDetail: (file: string) => void;
}>) {
  const [isExporting, setIsExporting] = useState(false);
  const issues = useMemo(() => validateDiagnosticReports(sessions), [sessions]);

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>Diagnostic Reports</h1>
      {sessions.length === 0 ? (
        <div style={{ color: '#888', fontSize: 14 }}>No diagnostic reports uploaded yet — see Get Started to upload one.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}></th>
                <th style={th}>Date</th>
                <th style={th}>Lab</th>
                <th style={th}>Observations</th>
              </tr>
            </thead>
            <tbody>
              {/* sessions is already date-descending, as produced by parseUpload/ResultsContext */}
              {sessions.map((group) => (
                <tr key={group.file} {...pressable(() => onOpenDetail(group.file))} style={{ cursor: 'pointer' }}>
                  <td style={td}>
                    {groupHasErrors(group.file, issues) && (
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea4335' }} title="Errors" />
                    )}
                    {!groupHasErrors(group.file, issues) && groupHasWarnings(group.file, issues) && (
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fbbc04' }} title="Warnings" />
                    )}
                  </td>
                  <td style={td}>{formatFullDate(group.date)}</td>
                  <td style={td}>{group.place}</td>
                  <td style={td}>{group.itemCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Export your complete Diagnostic Reports as JSON DB file</div>
            <div
              {...pressable(async () => {
                setIsExporting(true);
                try {
                  await exportData(sessions);
                } finally {
                  setIsExporting(false);
                }
              })}
              style={{
                display: 'inline-block',
                padding: '8px 20px',
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                border: '1.5px solid #1971c2',
                color: '#1971c2',
              }}
            >
              {isExporting ? 'Exporting...' : 'Export JSON'}
            </div>
          </div>
        )}
      )}
    </>
  );
}
