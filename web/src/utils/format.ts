import type { Result } from '../types';

const LOCALE_MAP: Record<string, string> = {
  'en': 'en-US',
  'ru-RU': 'ru-RU',
  'uk-UA': 'uk-UA',
};

export function formatDate(dateStr: string, lang: string = 'en'): string {
  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const locale = LOCALE_MAP[lang] || 'en-US';
  const month = d.toLocaleDateString(locale, { month: 'short' });
  // Capitalize first letter (some locales return lowercase)
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${year} ${monthCap}`;
}

export function formatResultValue(result: Result): string {
  if (result.rawValue != null && result.rawValue !== '') {
    return `${result.rawValue} ${result.unit || ''}`.trim();
  }
  if (result.value == null) return '—';
  return `${result.value} ${result.unit || ''}`.trim();
}

export function formatResultReference(result: Result): string {
  if (result.refText) return result.refText;
  if (result.refMin != null && result.refMax != null) return result.refMin + ' – ' + result.refMax;
  if (result.refMin != null) return '> ' + result.refMin;
  if (result.refMax != null) return '< ' + result.refMax;
  return '—';
}

export function formatFrequencyText(text: string): string {
  if (!text) return '';
  const normalized = text.replace(/\s*;\s*/g, ', ').trim();
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

export function isOutOfRange(r: Result): boolean {
  if (r.refMin == null || r.refMax == null || r.value == null) return false;
  return r.value < r.refMin || r.value > r.refMax;
}

export function isNearOutOfRange(r: Result): boolean {
  if (r.refMin == null || r.refMax == null || r.value == null) return false;
  if (isOutOfRange(r)) return false;
  const range = r.refMax - r.refMin;
  const margin = range * 0.1;
  return r.value < r.refMin + margin || r.value > r.refMax - margin;
}
