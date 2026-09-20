import { sha256Hex } from '../contentHash';

export const HELD_FILES_KEY = 'paneloom_held_files_v1';

/**
 * The stored files exactly as imported or pulled (ADR-0028); export, zip and push send these texts
 * back unchanged. `state` records what the local view of each non-report file looked like right
 * after the import, so a later change is told from an untouched file.
 */
export type HeldFiles = {
  reports: Record<string, string>;
  other: Record<string, string>;
  state: Record<string, string | null>;
  manifest?: string;
  digest?: string;
};

export const NO_HELD_FILES: HeldFiles = { reports: {}, other: {}, state: {} };

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
