import { useState } from 'react';
import type { DiagnosticReport } from '../../types';
import { backupFilename, buildBackupFiles, zipBackupFiles } from '../../data/backupArchive';
import { BackupImportError, readBackup, unzipBackup, type BackupContents } from '../../data/backupRestore';
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

async function readBackupFile(file: File): Promise<BackupContents> {
  const [fflate, bytes] = await Promise.all([import('fflate'), file.arrayBuffer()]);
  return readBackup(unzipBackup(new Uint8Array(bytes), fflate));
}

export function AccountView({
  sessions,
  onClearAll,
  onImportAll,
}: Readonly<{
  sessions: DiagnosticReport[];
  onClearAll: () => void;
  onImportAll: (backup: BackupContents) => Promise<string[]>;
}>) {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[] | null>(null);

  async function run(kind: 'export' | 'import', task: () => Promise<void>, failure: string) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof BackupImportError ? `${e.message} Nothing was changed.` : failure);
    } finally {
      setBusy(null);
    }
  }

  const importBackup = (file: File) =>
    run(
      'import',
      async () => {
        const backup = await readBackupFile(file);
        if (!window.confirm('Importing this backup replaces everything this app stores in this browser. Continue?')) return;
        setNotice(['Backup imported.', ...(await onImportAll(backup))]);
      },
      'Import failed. Please try again.'
    );

  const clearAll = () => {
    if (busy) return;
    if (!window.confirm('Remove everything this app stores in this browser: lab reports, medications, scheduled visits and settings? This cannot be undone.')) return;
    onClearAll();
    setError(null);
    setNotice(['All data was removed from this browser.']);
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Account</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 16, maxWidth: 640 }}>
        Download everything this browser holds for you — lab reports, medications, scheduled visits, laboratory
        prices and view settings — as one zip file, or import one to replace it.
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div {...pressable(() => run('export', () => downloadBackup(sessions), 'Export failed. Please try again.'))} style={ACTION}>
          {busy === 'export' ? 'Exporting...' : 'Export all data'}
        </div>
        <label style={ACTION}>
          {busy === 'import' ? 'Importing...' : 'Import all data'}
          <input
            type="file"
            accept=".zip,application/zip"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void importBackup(file);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      {error && <div style={{ color: COLOR.statusBad, fontSize: 13, marginTop: 12 }}>{error}</div>}
      {notice && (
        <div style={{ fontSize: 13, marginTop: 12 }}>
          {notice.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
      <div style={{ borderTop: `1px solid ${COLOR.borderSubtle}`, marginTop: 24, paddingTop: 16, maxWidth: 640 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Clear all data</div>
        <div style={{ color: COLOR.textMuted, fontSize: 13, marginBottom: 12 }}>
          Removes everything this app stores in this browser. Export first if you want to keep it.
        </div>
        <div {...pressable(clearAll)} style={{ ...ACTION, border: `1.5px solid ${COLOR.statusBad}`, color: COLOR.statusBad }}>
          Clear all data
        </div>
      </div>
    </div>
  );
}
