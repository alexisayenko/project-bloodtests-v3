export const ENVELOPE_META_KEY = 'bloodtests_envelope_meta_v1';

// Device-local: the sex that picks sex-specific reference ranges. Never written into an export;
// a stored file keeps whatever subject, sex, birthYear and notes it already carries (ADR-0028).
export type EnvelopeMeta = {
  sex?: 'female' | 'male';
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function sanitizeEnvelopeMeta(raw: unknown): EnvelopeMeta {
  if (!isRecord(raw)) return {};
  return raw.sex === 'female' || raw.sex === 'male' ? { sex: raw.sex } : {};
}

export function loadEnvelopeMeta(): EnvelopeMeta {
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
