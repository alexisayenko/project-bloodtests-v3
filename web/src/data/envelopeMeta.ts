const ENVELOPE_META_KEY = 'bloodtests_envelope_meta_v1';

export type EnvelopeMeta = {
  generatedAt?: string;
  subject?: string;
  sex?: 'female' | 'male';
  birthYear?: number;
  notes?: string;
};

export function loadEnvelopeMeta(): EnvelopeMeta {
  try {
    const raw = localStorage.getItem(ENVELOPE_META_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return {};
}

export function saveEnvelopeMeta(meta: EnvelopeMeta): void {
  try {
    localStorage.setItem(ENVELOPE_META_KEY, JSON.stringify(meta));
  } catch {
    // storage unavailable -- metadata just won't persist
  }
}
