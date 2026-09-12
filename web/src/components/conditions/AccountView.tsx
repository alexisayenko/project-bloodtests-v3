import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { DiagnosticReport } from '../../types';
import { backupFilename, buildBackupFiles, zipBackupFiles } from '../../data/backupArchive';
import { BackupImportError, readBackup, unzipBackup, type BackupContents } from '../../data/backupRestore';
import { loadEnvelopeMeta } from '../../data/envelopeMeta';
import { Database, Download, HardDriveDownload, SlidersHorizontal, Trash2, Upload, type LucideIcon } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { Button, Card, CardDescription, CardTitle, DangerCard, FileButton, IconBadge, buttonStyle } from '../primitives';
import { COLOR, SPACE } from '../../styles/tokens';

const HOLD_TO_CLEAR_MS = 2000;

/** "Clear all data": a press-and-hold trigger (mouse, touch and keyboard) instead of a confirm() dialog — the hold itself is the confirmation. */
function HoldToClearButton({
  onConfirm,
  disabled,
  idleLabel,
  holdingLabel,
}: Readonly<{ onConfirm: () => void; disabled?: boolean; idleLabel: string; holdingLabel: string }>) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const activeRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const stop = () => {
    activeRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    startRef.current = null;
    setHolding(false);
    setProgress(0);
  };

  useEffect(() => stop, []);

  const tick = (now: number) => {
    if (startRef.current === null) startRef.current = now;
    const fraction = Math.min(1, (now - startRef.current) / HOLD_TO_CLEAR_MS);
    setProgress(fraction);
    if (fraction >= 1) {
      stop();
      onConfirm();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (disabled || activeRef.current) return;
    activeRef.current = true;
    setHolding(true);
    startRef.current = null;
    frameRef.current = requestAnimationFrame(tick);
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    start();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    start();
  };

  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') stop();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={stop}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      style={{ ...buttonStyle('danger', 'md', disabled), position: 'relative', overflow: 'hidden' }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: COLOR.statusBadBg }} />
      <span style={{ position: 'relative' }}>{holding ? holdingLabel : idleLabel}</span>
    </button>
  );
}

const ACTION_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: SPACE[4],
  maxWidth: 960,
} as const;

const ACTION_CARD = { display: 'flex', flexDirection: 'column', gap: SPACE[3], padding: '20px 22px' } as const;

function ActionCardBody({
  icon,
  iconColor,
  iconBackground,
  title,
  description,
  children,
}: Readonly<{
  icon: LucideIcon;
  iconColor?: string;
  iconBackground?: string;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <>
      <IconBadge icon={icon} color={iconColor} background={iconBackground} />
      <div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: SPACE[1] }}>{children}</div>
    </>
  );
}

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
      <div style={ACTION_GRID}>
        <Card style={ACTION_CARD}>
          <ActionCardBody
            icon={Download}
            title="Export all data"
            description="Download reports, medications, scheduled visits, prices and settings as one zip file."
          >
            <Button variant="primary" onClick={() => run('export', () => downloadBackup(sessions), 'Export failed. Please try again.')}>
              {busy === 'export' ? 'Exporting...' : 'Export all data'}
            </Button>
          </ActionCardBody>
        </Card>
        <Card style={ACTION_CARD}>
          <ActionCardBody
            icon={Upload}
            title="Import all data"
            description="Restore a backup zip. It replaces everything this app stores in this browser."
          >
            <FileButton accept=".zip,application/zip" onFile={(file) => void importBackup(file)}>
              {busy === 'import' ? 'Importing...' : 'Import all data'}
            </FileButton>
          </ActionCardBody>
        </Card>
        <DangerCard style={ACTION_CARD}>
          <ActionCardBody
            icon={Trash2}
            iconColor={COLOR.statusBadText}
            iconBackground={COLOR.statusBadBg}
            title="Clear all data"
            description="Removes everything this app stores in this browser. Export first if you want to keep it."
          >
            <HoldToClearButton onConfirm={clearAll} disabled={!!busy} idleLabel="Clear all data" holdingLabel="Keep holding…" />
          </ActionCardBody>
        </DangerCard>
      </div>
      {error && <div style={{ color: COLOR.statusBadText, fontSize: 13, marginTop: SPACE[4] }}>{error}</div>}
      {notice && (
        <Card style={{ marginTop: SPACE[4], maxWidth: 960, fontSize: 13, color: COLOR.textSecondary, background: COLOR.surfaceMint }}>
          {notice.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </Card>
      )}
    </div>
  );
}
