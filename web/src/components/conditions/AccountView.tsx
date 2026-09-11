import { useState } from 'react';
import type { DiagnosticReport } from '../../types';
import { backupFilename, buildBackupFiles, zipBackupFiles } from '../../data/backupArchive';
import { BackupImportError, readBackup, unzipBackup, type BackupContents } from '../../data/backupRestore';
import { loadEnvelopeMeta } from '../../data/envelopeMeta';
import { Database, HardDriveDownload, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { Button, FileButton, SectionTitle } from '../primitives';
import { COLOR } from '../../styles/tokens';

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
      <PageHeader
        overline="Data Vault & Management"
        titlePrimary="Account &"
        titleAccent="Storage"
        description={[
          'Download everything this browser holds for you — lab reports, medications, scheduled visits, laboratory prices and view settings — as one zip file, or import one to replace it.',
          'Your complete clinical data history stays locally under your ownership and control.',
        ]}
        pillars={[
          { icon: Database, line1: 'Offline-first', line2: 'browser storage' },
          { icon: HardDriveDownload, line1: 'Complete zip', line2: 'backup export' },
          { icon: SlidersHorizontal, line1: 'Instant restore', line2: 'at any time' },
        ]}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button onClick={() => run('export', () => downloadBackup(sessions), 'Export failed. Please try again.')}>
          {busy === 'export' ? 'Exporting...' : 'Export all data'}
        </Button>
        <FileButton accept=".zip,application/zip" onFile={(file) => void importBackup(file)}>
          {busy === 'import' ? 'Importing...' : 'Import all data'}
        </FileButton>
      </div>
      {error && <div style={{ color: COLOR.statusBadText, fontSize: 13, marginTop: 12 }}>{error}</div>}
      {notice && (
        <div style={{ fontSize: 13, marginTop: 12 }}>
          {notice.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
      <div style={{ borderTop: `1px solid ${COLOR.borderSubtle}`, marginTop: 24, paddingTop: 16, maxWidth: 640 }}>
        <SectionTitle>Clear all data</SectionTitle>
        <div style={{ color: COLOR.textMuted, fontSize: 13, marginBottom: 12 }}>
          Removes everything this app stores in this browser. Export first if you want to keep it.
        </div>
        <Button variant="danger" onClick={clearAll}>
          Clear all data
        </Button>
      </div>
    </div>
  );
}
