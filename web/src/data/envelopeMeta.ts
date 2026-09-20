import { HELD_FILES_KEY, parseHeldFiles } from './storage/heldFiles';

export const ENVELOPE_META_KEY = 'bloodtests_envelope_meta_v1';

// Device-local fallback: the sex that picks sex-specific reference ranges when no stored file carries one.
// Never written into an export; a stored file keeps whatever subject, sex, birthYear and notes it
// already carries (ADR-0028).
export type EnvelopeMeta = {
  sex?: 'female' | 'male';
};

/** What the held report files say about the person, read at display time and never written back. */
export type StoredFileMeta = {
  subject?: string;
  sex?: 'female' | 'male';
  birthYear?: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function sanitizeEnvelopeMeta(raw: unknown): EnvelopeMeta {
  if (!isRecord(raw)) return {};
  return raw.sex === 'female' || raw.sex === 'male' ? { sex: raw.sex } : {};
}

export function readStoredFileMeta(reports: Record<string, string>): StoredFileMeta {
  const meta: StoredFileMeta = {};
  for (const path of Object.keys(reports).sort()) {
    let envelope: unknown;
    try {
      envelope = JSON.parse(reports[path]!);
    } catch {
      continue;
    }
    if (!isRecord(envelope)) continue;
    if (meta.subject === undefined && typeof envelope.subject === 'string' && envelope.subject) meta.subject = envelope.subject;
    if (meta.sex === undefined && (envelope.sex === 'female' || envelope.sex === 'male')) meta.sex = envelope.sex;
    if (meta.birthYear === undefined && typeof envelope.birthYear === 'number') meta.birthYear = envelope.birthYear;
  }
  return meta;
}

let cachedRaw: string | null | undefined;
let cachedMeta: StoredFileMeta = {};

export function loadStoredFileMeta(): StoredFileMeta {
  try {
    const raw = localStorage.getItem(HELD_FILES_KEY);
    if (raw !== cachedRaw) {
      cachedMeta = readStoredFileMeta(parseHeldFiles(raw).reports);
      cachedRaw = raw;
    }
    return cachedMeta;
  } catch {
    return {};
  }
}

/** The sex the reference ranges use: the stored files' own, else the one set on this device. */
export function loadEnvelopeMeta(): EnvelopeMeta {
  const sex = loadStoredFileMeta().sex ?? loadLocalEnvelopeMeta().sex;
  return sex ? { sex } : {};
}

export function loadLocalEnvelopeMeta(): EnvelopeMeta {
  try {
    const raw = localStorage.getItem(ENVELOPE_META_KEY);
    if (raw) return sanitizeEnvelopeMeta(JSON.parse(raw));
  } catch {
    // corrupt storage reads as empty
  }
  return {};
}

export function saveEnvelopeMeta(meta: EnvelopeMeta): void {
  try {
    localStorage.setItem(ENVELOPE_META_KEY, JSON.stringify(sanitizeEnvelopeMeta(meta)));
  } catch {
    // storage unavailable
  }
}
