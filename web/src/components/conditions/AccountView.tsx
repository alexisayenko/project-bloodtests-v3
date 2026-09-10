import { useState } from 'react';
import type { DiagnosticReport } from '../../types';
import { backupFilename, buildBackupFiles, zipBackupFiles } from '../../data/backupArchive';
import { loadEnvelopeMeta } from '../../data/envelopeMeta';
import { pressable } from './ui';
import { COLOR } from '../../styles/tokens';

const ACTION = {
  display: 'inline-block',
  padding: '8px 20px',
  borderRadius: 9999,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  border: `1.5px solid ${COLOR.accent}`,
  color: COLOR.accent,
} as const;

async function downloadBackup(sessions: DiagnosticReport[]): Promise<void> {
  const now = new Date();
  const [fflate, files] = await Promise.all([
    import('fflate'),
    buildBackupFiles({
      sessions,
      meta: loadEnvelopeMeta(),
      storage: localStorage,
      app: { commit: __BUILD_COMMIT__, builtAt: __BUILD_TIME__ },
      now,
    }),
  ]);
  const zip = zipBackupFiles(files, fflate);
  const url = URL.createObjectURL(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename(now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AccountView({ sessions }: Readonly<{ sessions: DiagnosticReport[] }>) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Account</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 16, maxWidth: 640 }}>
        Download everything this browser holds for you — lab reports, medications, scheduled visits, laboratory
        prices and view settings — as one zip file.
      </div>
      <div
        {...pressable(async () => {
          if (isExporting) return;
          setIsExporting(true);
          setError(null);
          try {
            await downloadBackup(sessions);
          } catch {
            setError('Export failed. Please try again.');
          } finally {
            setIsExporting(false);
          }
        })}
        style={ACTION}
      >
        {isExporting ? 'Exporting...' : 'Export all data'}
      </div>
      {error && <div style={{ color: COLOR.statusBad, fontSize: 13, marginTop: 12 }}>{error}</div>}
    </div>
  );
}
