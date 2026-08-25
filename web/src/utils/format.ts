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

// Adaptive precision by magnitude — fewer decimals as the value grows.
// Only used when there's no rawValue to show as-printed; see
// docs/ui-ux/style-guide.md#numbers. Ported from project-bloodtests-v2's
// engine/src/format.ts (fmtNum).
function decimalsFor(a: number): number {
  if (a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 1) return 2;
  return 3;
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return '';
  return String(Number(v.toFixed(decimalsFor(Math.abs(v)))));
}

export function formatResultValue(result: Result): string {
  if (result.rawValue != null && result.rawValue !== '') {
    return `${result.rawValue} ${result.unit || ''}`.trim();
  }
  if (result.value == null) return '—';
  return `${fmtNum(result.value)} ${result.unit || ''}`.trim();
}

export function formatResultReference(result: Result): string {
  if (result.refText) return result.refText;
  if (result.refMin != null && result.refMax != null) return fmtNum(result.refMin) + ' – ' + fmtNum(result.refMax);
  if (result.refMin != null) return '> ' + fmtNum(result.refMin);
  if (result.refMax != null) return '< ' + fmtNum(result.refMax);
  return '—';
}

export function formatFrequencyText(text: string): string {
  if (!text) return '';
  const normalized = text.split(';').map((part) => part.trim()).filter(Boolean).join(', ');
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

export function isOutOfRange(r: Result): boolean {
  if (r.value == null || (r.refMin == null && r.refMax == null)) return false;
  if (r.refMin != null && r.value < r.refMin) return true;
  if (r.refMax != null && r.value > r.refMax) return true;
  return false;
}

export function isNearOutOfRange(r: Result): boolean {
  if (r.refMin == null || r.refMax == null || r.value == null) return false;
  if (isOutOfRange(r)) return false;
  const range = r.refMax - r.refMin;
  const margin = range * 0.1;
  return r.value < r.refMin + margin || r.value > r.refMax - margin;
}
