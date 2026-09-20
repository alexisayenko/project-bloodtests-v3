import { sha256Hex } from '../contentHash';

export const HELD_FILES_KEY = 'paneloom_held_files_v1';

/**
 * The stored files exactly as imported or pulled (ADR-0028); export, zip and push send these texts
 * back unchanged. `state` records what the local view of each non-report file looked like right
 * after the import, so a later change is told from an untouched file.
 */
export type PendingChanges = {
  /** Report files the user added or edited in this browser since the last pull or push. */
  reports: string[];
  /** Report files the user removed. */
  removed: string[];
  /** medications.json, scheduled-visits.json, settings.json written by an import here. */
  other: string[];
};

export const NO_PENDING: PendingChanges = { reports: [], removed: [], other: [] };

export type HeldFiles = {
  reports: Record<string, string>;
  other: Record<string, string>;
  state: Record<string, string | null>;
  manifest?: string;
  digest?: string;
  pending: PendingChanges;
};

export const NO_HELD_FILES: HeldFiles = { reports: {}, other: {}, state: {}, pending: NO_PENDING };

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function parsePending(value: unknown): PendingChanges {
  if (typeof value !== 'object' || value === null) return NO_PENDING;
  const { reports, removed, other } = value as Record<string, unknown>;
  return { reports: isTextList(reports) ? reports : [], removed: isTextList(removed) ? removed : [], other: isTextList(other) ? other : [] };
}

/** Records what the user changed here, so a later push sends those files and nothing else. */
export function withPending(held: HeldFiles, add: Partial<PendingChanges>): HeldFiles {
  const union = (a: string[], b: readonly string[] = []) => [...new Set([...a, ...b])];
  const removed = union(held.pending.removed, add.removed).filter((path) => !(path in held.reports));
  const reports = union(held.pending.reports, add.reports).filter((path) => path in held.reports);
  return { ...held, pending: { reports, removed, other: union(held.pending.other, add.other) } };
}

function isTextMap(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && Object.values(value).every((v) => typeof v === 'string');
}

/** Anything unreadable reads as nothing held. */
export function parseHeldFiles(raw: string | null): HeldFiles {
  if (!raw) return NO_HELD_FILES;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || !isTextMap(parsed.reports) || !isTextMap(parsed.other)) return NO_HELD_FILES;
    const state = typeof parsed.state === 'object' && parsed.state !== null ? (parsed.state as HeldFiles['state']) : {};
    return {
      reports: parsed.reports,
      other: parsed.other,
      state,
      pending: parsePending(parsed.pending),
      ...(typeof parsed.manifest === 'string' && typeof parsed.digest === 'string' && { manifest: parsed.manifest, digest: parsed.digest }),
    };
  } catch {
    return NO_HELD_FILES;
  }
}

export function loadHeldFiles(): HeldFiles {
  try {
    return parseHeldFiles(localStorage.getItem(HELD_FILES_KEY));
  } catch {
    return NO_HELD_FILES;
  }
}

export function saveHeldFiles(held: HeldFiles): void {
  localStorage.setItem(HELD_FILES_KEY, JSON.stringify(held));
}

/** Order-independent, so a file re-saved with the same content in another key order still matches. */
export function payloadDigest(payload: Record<string, string>): string {
  const entries = Object.entries(payload).sort(([a], [b]) => (a < b ? -1 : 1));
  return sha256Hex(JSON.stringify(entries));
}
