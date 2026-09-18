import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { DiagnosticReport } from '../../types';
import { backupFilename, buildBackupFiles, zipBackupFiles } from '../../data/backupArchive';
import { BackupImportError, readBackup, unzipBackup, type BackupContents } from '../../data/backupRestore';
import { loadEnvelopeMeta, saveEnvelopeMeta, type EnvelopeMeta } from '../../data/envelopeMeta';
import { Database, Download, HardDriveDownload, LogIn, SlidersHorizontal, Trash2, Upload, UserCircle, type LucideIcon } from 'lucide-react';
import { PageHeader } from './PageHeader';
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  DangerCard,
  FIELD_INPUT,
  FileButton,
  IconBadge,
  VISUALLY_HIDDEN,
  buttonStyle,
} from '../primitives';
import { COLOR, SPACE } from '../../styles/tokens';
import { useSupabaseAuthUser } from '../../hooks/useSupabaseAuthUser';
import { signInWithApple, signInWithGoogle, signOutUser, supabase } from '../../supabase/auth';
import { pullCloudFiles, pushCloudFiles } from '../../supabase/sync';

const FIELD_LABEL = { color: COLOR.textSecondary, fontWeight: 600, textAlign: 'right' } as const;

async function currentLocalFiles(sessions: DiagnosticReport[]): Promise<Record<string, string>> {
  return buildBackupFiles({
    sessions,
    meta: loadEnvelopeMeta(),
    storage: localStorage,
    app: { commit: __BUILD_COMMIT__, builtAt: __BUILD_TIME__ },
    now: new Date(),
  });
}

// An empty local backup never overwrites a populated cloud document on sign-out.
function isEmptyBackup(backup: BackupContents): boolean {
  return !backup.reports?.count && !backup.medications?.rows.length && !backup.scheduled?.visits.length;
}

/**
 * One-time cutover (ADR-0018): sign-in pulls the cloud copy if one exists, else pushes local up; sign-out
 * pushes then wipes. OAuth is redirect-based, so sync is wired to the 'SIGNED_IN' event, never
 * 'INITIAL_SESSION', which fires for an already-signed-in returning visit.
 */
function AccountAuthCard({
  sessions,
  onImportAll,
  onClearAll,
}: Readonly<{
  sessions: DiagnosticReport[];
  onImportAll: (backup: BackupContents) => Promise<string[]>;
  onClearAll: () => void;
}>) {
  const { user, loading } = useSupabaseAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function flashNotice(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  }

  async function syncAfterSignIn(uid: string) {
    const cloudFiles = await pullCloudFiles(uid);
    if (cloudFiles) {
      await onImportAll(readBackup(cloudFiles));
      flashNotice('✓ Synced from cloud.');
    } else {
      await pushCloudFiles(uid, await currentLocalFiles(sessions));
      flashNotice('✓ Backed up to cloud.');
    }
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session) return;
      setError(null);
      syncAfterSignIn(session.user.id).catch(() => setError('Something went wrong. Please try again.'));
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  async function handleSignIn(signIn: typeof signInWithGoogle) {
    setError(null);
    setSigningIn(true);
    const { error: signInError } = await signIn();
    if (signInError) {
      setError('Something went wrong. Please try again.');
      setSigningIn(false);
    }
    // On success the page navigates away to the OAuth provider; nothing more to do here.
  }

  async function handleSignOut() {
    if (!user) return;
    setError(null);
    setSigningOut(true);
    try {
      const localFiles = await currentLocalFiles(sessions);
      const cloudFiles = await pullCloudFiles(user.id);
      const localIsEmpty = isEmptyBackup(readBackup(localFiles));
      const cloudHasData = cloudFiles !== null && !isEmptyBackup(readBackup(cloudFiles));
      if (!(localIsEmpty && cloudHasData)) {
        await pushCloudFiles(user.id, localFiles);
      }
      await signOutUser();
      onClearAll();
      flashNotice('✓ Signed out.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  let authSection: ReactNode;
  if (loading) {
    authSection = <span style={{ fontSize: 13, color: COLOR.textMuted }}>Loading…</span>;
  } else if (user) {
    authSection = (
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        <span style={{ fontSize: 13, color: COLOR.textSecondary }}>{user.email}</span>
        <Button variant="secondary" disabled={signingOut} onClick={handleSignOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    );
  } else {
    authSection = (
      <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap' }}>
        <Button variant="secondary" disabled={signingIn} onClick={() => handleSignIn(signInWithGoogle)}>
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </Button>
        <Button variant="secondary" disabled={signingIn} onClick={() => handleSignIn(signInWithApple)}>
          {signingIn ? 'Signing in…' : 'Sign in with Apple'}
        </Button>
      </div>
    );
  }

  return (
    <Card style={{ maxWidth: 960, marginBottom: SPACE[5] }}>
      <CardHeader
        icon={<IconBadge icon={user ? UserCircle : LogIn} size={36} />}
        title="Account"
        description={user ? 'Signed in. Your data is synced to the cloud.' : 'Sign in to sync your data to the cloud.'}
      />
      <div style={{ marginTop: SPACE[4], paddingTop: SPACE[4], borderTop: `1px solid ${COLOR.borderSubtle}` }}>
        {authSection}
        {notice && <div style={{ color: COLOR.statusOkText, fontSize: 13, marginTop: SPACE[3] }}>{notice}</div>}
        {error && <div style={{ color: COLOR.statusBadText, fontSize: 13, marginTop: SPACE[3] }}>{error}</div>}
      </div>
    </Card>
  );
}

/** Subject/sex/birth-year/notes written into every export. */
function DatabaseDetailsCard() {
  const [meta, setMeta] = useState<EnvelopeMeta>(() => loadEnvelopeMeta());

  function updateMeta(patch: Partial<EnvelopeMeta>) {
    setMeta((prev) => {
      const next = { ...prev, ...patch };
      saveEnvelopeMeta(next);
      return next;
    });
  }

  return (
    <Card style={{ maxWidth: 960, marginBottom: SPACE[5] }}>
      <CardHeader
        icon={<IconBadge icon={Database} size={36} />}
        title="Database details"
        description="Subject, sex, birth year and notes written into each export."
      />
      <div
        style={{
          marginTop: SPACE[4],
          paddingTop: SPACE[4],
          borderTop: `1px solid ${COLOR.borderSubtle}`,
          display: 'grid',
          gridTemplateColumns: '90px minmax(0, 480px)',
          columnGap: 14,
          rowGap: 12,
          alignItems: 'center',
          fontSize: 13,
        }}
      >
        <span style={{ color: COLOR.textMuted, textAlign: 'right' }}>Generated at</span>
        <span style={{ color: COLOR.textMuted }}>
          {meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : '—'}
          <span style={{ color: COLOR.textDisabled, fontSize: 11, marginLeft: 8 }}>updates on each export</span>
        </span>
        <span style={FIELD_LABEL}>Subject</span>
        <input
          type="text"
          value={meta.subject ?? ''}
          onChange={(e) => updateMeta({ subject: e.currentTarget.value || undefined })}
          style={{ ...FIELD_INPUT, width: '100%', boxSizing: 'border-box' }}
        />
        <span style={FIELD_LABEL}>Sex</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={meta.sex ?? ''}
            onChange={(e) => {
              const v = e.currentTarget.value;
              updateMeta({ sex: v === 'female' || v === 'male' ? v : undefined });
            }}
            style={FIELD_INPUT}
          >
            <option value="">(not set)</option>
            <option value="female">female</option>
            <option value="male">male</option>
          </select>
          <span style={{ color: COLOR.textSecondary, fontWeight: 600 }}>Birth year</span>
          <input
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            step={1}
            value={meta.birthYear ?? ''}
            onChange={(e) => {
              const v = e.currentTarget.value;
              updateMeta({ birthYear: v === '' ? undefined : Number(v) });
            }}
            style={{ ...FIELD_INPUT, width: 90 }}
          />
        </div>
        <span style={{ ...FIELD_LABEL, alignSelf: 'start', marginTop: 6 }}>Notes</span>
        <textarea
          rows={4}
          value={meta.notes ?? ''}
          onChange={(e) => updateMeta({ notes: e.currentTarget.value || undefined })}
          style={{ ...FIELD_INPUT, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>
    </Card>
  );
}

const HOLD_TO_CLEAR_MS = 2000;

/** The hold itself is the confirmation; no confirm() dialog. */
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
    startRef.current ??= now;
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
      style={{ ...buttonStyle('danger', 'md', disabled), position: 'relative', overflow: 'hidden' }}
    >
      <span
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: COLOR.statusBadBg }}
      />
      <progress value={Math.round(progress * 100)} max={100} aria-label="Hold-to-clear progress" style={VISUALLY_HIDDEN} />
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
      <AccountAuthCard sessions={sessions} onImportAll={onImportAll} onClearAll={onClearAll} />
      <DatabaseDetailsCard />
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
