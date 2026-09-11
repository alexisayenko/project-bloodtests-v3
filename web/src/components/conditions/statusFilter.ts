import type { StatusTone } from '../primitives/tones';

/** Toggle order in the Monitoring Panels toolbar. */
export const FILTER_TONES: readonly StatusTone[] = ['ok', 'warn', 'bad', 'none'];

export const ALL_TONES: ReadonlySet<StatusTone> = new Set(FILTER_TONES);
export const ABNORMAL_TONES: ReadonlySet<StatusTone> = new Set<StatusTone>(['warn', 'bad']);

export type ToneCounts = Record<StatusTone, number>;

export type Toned<T> = { item: T; tone: StatusTone };

/** One count per tone over every chip given — a marker shown in two panels is two chips and counts twice. */
export function countTones(tones: Iterable<StatusTone>): ToneCounts {
  const counts: ToneCounts = { ok: 0, warn: 0, bad: 0, none: 0 };
  for (const tone of tones) counts[tone] += 1;
  return counts;
}

export function toggleTone(active: ReadonlySet<StatusTone>, tone: StatusTone): Set<StatusTone> {
  const next = new Set(active);
  if (next.has(tone)) next.delete(tone);
  else next.add(tone);
  return next;
}

export function sameTones(a: ReadonlySet<StatusTone>, b: ReadonlySet<StatusTone>): boolean {
  return a.size === b.size && [...a].every((tone) => b.has(tone));
}

/** True when at least one status is switched off, so some chip may be hidden. */
export function isToneFilterActive(active: ReadonlySet<StatusTone>): boolean {
  return FILTER_TONES.some((tone) => !active.has(tone));
}

export function filterByTone<T>(chips: readonly Toned<T>[], active: ReadonlySet<StatusTone>): Toned<T>[] {
  return chips.filter((chip) => active.has(chip.tone));
}

export function markerCountLabel(visible: number, total: number, filtered: boolean): string {
  return filtered ? `${visible} of ${total} markers` : `${total} markers`;
}
