import type { ResultGroup } from '../types';
import { SHORT_LABELS } from '../components/conditions/markers';

// Fabricates a few sessions of plausible-looking results for every marker in
// SHORT_LABELS. Each LOINC gets a stable synthetic reference range (seeded by a
// hash of the code, so regenerating keeps ranges consistent), and each value is
// drawn near that range with roughly a 1-in-6 chance of landing outside it.
export function generateTestData(): ResultGroup[] {
  const hash = (s: string) => {
    let h = 0;
    for (const c of s) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
    return h;
  };
  const round = (v: number) => Math.round(v * 100) / 100;
  const today = new Date();
  const dates: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i * 4, 15);
    dates.push(d.toISOString().slice(0, 10));
  }
  // Math.random() throughout: non-cryptographic randomness is exactly right for
  // fabricated demo data (NOSONAR S2245).
  const rnd = () => Math.random(); // NOSONAR
  return dates.map((date) => {
    const items = Object.entries(SHORT_LABELS)
      .filter(() => rnd() > 0.25) // each report covers ~75% of markers
      .map(([loinc, { short, unit }]) => {
        const h = hash(loinc);
        const refMin = round((h % 90) + 10);
        const refMax = round(refMin * (1.5 + ((h >> 8) % 100) / 100));
        const span = refMax - refMin;
        // Mostly inside the range; ~1 in 6 drifts below or above it.
        const roll = rnd();
        let value: number;
        if (roll < 0.08) value = refMin - rnd() * span * 0.3;
        else if (roll < 0.16) value = refMax + rnd() * span * 0.3;
        else value = refMin + rnd() * span;
        const v = round(Math.max(0, value));
        return {
          loinc,
          analysis: short,
          symbol: short,
          section: '',
          value: v,
          rawValue: String(v),
          valueQualifier: '',
          unit,
          refText: `${refMin} - ${refMax}`,
          refMin,
          refMax,
          method: '',
        };
      });
    return { date, place: 'Test Data Lab', file: `generated__${date}`, items, itemCount: items.length };
  });
}
