export const ENVELOPE_META_KEY = 'bloodtests_envelope_meta_v1';

export type EnvelopeMeta = {
  generatedAt?: string;
  subject?: string;
  sex?: 'female' | 'male';
  birthYear?: number;
  notes?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function sanitizeEnvelopeMeta(raw: unknown): EnvelopeMeta {
  if (!isRecord(raw)) return {};
  const out: EnvelopeMeta = {};
  if (typeof raw.generatedAt === 'string') out.generatedAt = raw.generatedAt;
  if (typeof raw.subject === 'string') out.subject = raw.subject;
  if (raw.sex === 'female' || raw.sex === 'male') out.sex = raw.sex;
  if (typeof raw.birthYear === 'number' && Number.isFinite(raw.birthYear)) out.birthYear = raw.birthYear;
  if (typeof raw.notes === 'string') out.notes = raw.notes;
  return out;
}

export function loadEnvelopeMeta(): EnvelopeMeta {
  try {
    const raw = localStorage.getItem(ENVELOPE_META_KEY);
    if (raw) return sanitizeEnvelopeMeta(JSON.parse(raw));
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return {};
}

export function saveEnvelopeMeta(meta: EnvelopeMeta): void {
  try {
    localStorage.setItem(ENVELOPE_META_KEY, JSON.stringify(sanitizeEnvelopeMeta(meta)));
  } catch {
    // storage unavailable -- metadata just won't persist
  }
}
