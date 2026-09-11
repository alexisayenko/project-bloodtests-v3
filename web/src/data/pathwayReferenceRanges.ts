import file from '../../public/data/pathway-reference-ranges.json';
import { MOLAR_MASS_BY_ID, concentrationRatio, massPerMolarUnit, molarPerMassUnit } from './molarMasses';
import { sameUnitScale, toLatinUnit } from './unitNormalization';

/**
 * Curated reference ranges for the Hormonal Pathways view, read from
 * `pathway-reference-ranges.json` (ADR-0010). Each figure stays as its source
 * printed it; a display in another unit is derived here through the unit
 * helpers and the molar-mass table (ADR-0011), never through a typed factor.
 */

export interface PathwayRange {
  population: string;
  low?: number;
  high?: number;
  unit: string;
  sources: string[];
}

export interface PathwayRangeMarker {
  id: string;
  name: string;
  loincs: string[];
  molarMass?: string;
  ranges: PathwayRange[];
}

export interface PathwayRangeSource {
  id: string;
  organization: string;
  title: string;
  year?: number;
  url: string;
  retrieved: string;
  quote: string;
}

const data = file as { markers: PathwayRangeMarker[]; sources: PathwayRangeSource[] };

export const PATHWAY_RANGE_MARKERS: readonly PathwayRangeMarker[] = data.markers;
export const PATHWAY_RANGE_SOURCES: readonly PathwayRangeSource[] = data.sources;
export const PATHWAY_RANGE_SOURCE_BY_ID: Readonly<Record<string, PathwayRangeSource>> = Object.fromEntries(
  data.sources.map((s) => [s.id, s])
);

/** The curated entry for whichever of these codes it lists. */
export function pathwayRangesFor(loincs: readonly string[]): PathwayRangeMarker | undefined {
  return PATHWAY_RANGE_MARKERS.find((m) => m.loincs.some((l) => loincs.includes(l)));
}

const isMass = (unit: string) => concentrationRatio(unit, 'g/L') !== undefined;
const isMolar = (unit: string) => concentrationRatio(unit, 'mol/L') !== undefined;

/**
 * `value` in `from` expressed in `to`, or undefined when no exact path exists:
 * the same unit under another spelling, a same-dimension rescale, or a
 * mass↔molar step over a tabulated molar mass.
 */
export function convertConcentration(value: number, from: string, to: string, molarMass?: string): number | undefined {
  const latinFrom = toLatinUnit(from) ?? from;
  const latinTo = toLatinUnit(to) ?? to;
  if (latinFrom === latinTo || sameUnitScale(latinFrom, latinTo)) return value;
  const ratio = concentrationRatio(latinFrom, latinTo);
  if (ratio !== undefined) return value * ratio;
  if (!molarMass || !MOLAR_MASS_BY_ID[molarMass]) return undefined;
  if (isMass(latinFrom) && isMolar(latinTo)) return value * molarPerMassUnit(molarMass, latinFrom, latinTo);
  if (isMolar(latinFrom) && isMass(latinTo)) return value * massPerMolarUnit(molarMass, latinTo, latinFrom);
  return undefined;
}

export interface PlacedRange extends PathwayRange {
  /** True when the figures are in the requested unit; false = left in the source's own unit. */
  placed: boolean;
}

/**
 * One row per population: in `unit` when any of that population's rows
 * converts to it, otherwise its first row exactly as the source printed it.
 */
export function rangesInUnit(marker: PathwayRangeMarker, unit: string | undefined): PlacedRange[] {
  const populations = [...new Set(marker.ranges.map((r) => r.population))];
  return populations.map((population) => {
    const rows = marker.ranges.filter((r) => r.population === population);
    for (const row of rows) {
      if (!unit) break;
      const low = row.low == null ? undefined : convertConcentration(row.low, row.unit, unit, marker.molarMass);
      const high = row.high == null ? undefined : convertConcentration(row.high, row.unit, unit, marker.molarMass);
      if ((row.low == null || low !== undefined) && (row.high == null || high !== undefined)) {
        return { ...row, low, high, unit, placed: true };
      }
    }
    return { ...rows[0], placed: false };
  });
}

const within = (value: number, r: PlacedRange) => (r.low == null || value >= r.low) && (r.high == null || value <= r.high);

/**
 * ok inside every placed range, warn inside only some (the population is not
 * known, so the ranges disagree about this value), bad inside none; undefined
 * when no range is in the value's unit.
 */
export function rangeStatus(value: number, ranges: readonly PlacedRange[]): 'ok' | 'warn' | 'bad' | undefined {
  const placed = ranges.filter((r) => r.placed);
  if (placed.length === 0) return undefined;
  const hits = placed.filter((r) => within(value, r)).length;
  if (hits === placed.length) return 'ok';
  return hits > 0 ? 'warn' : 'bad';
}
