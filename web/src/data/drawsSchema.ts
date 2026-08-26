/**
 * Zod schema for the canonical current lab-results shape, ported from
 * project-bloodtests-v2's `engine/src/schema.ts` (that repo's schema-first
 * data contract, ADR-0006 there). This is the shape produced by v2's own
 * pipeline and used in production at homepage/bloodtests.json: per-draw
 * `{ date, labName, items }`, per-item `original`/`us`/`si` unit values.
 *
 * Backward-compat: the analyte short code was historically keyed `symbol`. A
 * preprocess step aliases a legacy `symbol` key onto `shortName` (only when
 * `shortName` is absent), so un-migrated data still parses.
 *
 * v3 only consumes `original` (the lab-reported value) when transforming
 * this into its own `ResultGroup[]` — see parseUpload.ts. `us`/`si`/`calculated`
 * are validated but not otherwise used yet.
 */

import { z } from 'zod';

/** LOINC structural check: body + hyphen + one check digit. */
export const LoincSchema = z.string().regex(/^\d+-\d$/, 'invalid LOINC code');

export const UnitValueSchema = z.object({
  value: z.number().nullable(),
  unit: z.string().nullable().optional(),
  refMin: z.number().nullable().optional(),
  refMax: z.number().nullable().optional(),
  refText: z.string().nullable().optional(),
  rawValue: z.string().nullable().optional(),
});

/**
 * The engine's own derivation of a quantity the report also carries (e.g.
 * indirect bilirubin = total − direct). Stored alongside the reported value,
 * never substituted for it. v3 doesn't consume this yet.
 */
export const CalculatedValueSchema = z.object({
  value: z.number(),
  unit: z.string().nullable().optional(),
  formula: z.string(),
  inputs: z.array(z.object({ key: z.string(), value: z.number() })).default([]),
});

export const LabItemObjectSchema = z
  .object({
    shortName: z.string().nullable().optional(),
    analysis: z.string().nullable().optional(),
    loinc: LoincSchema.nullable().optional(),
    method: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    sourceRow: z.string().nullable().optional(),
    original: UnitValueSchema,
    us: UnitValueSchema,
    si: UnitValueSchema,
    calculated: CalculatedValueSchema.nullable().optional(),
  })
  .refine((it) => it.shortName != null || it.analysis != null || it.loinc != null, {
    message: 'item needs at least one of shortName / analysis / loinc',
  });

/**
 * Accepts the current `shortName` key and the legacy `symbol` alias: a bare
 * `symbol` is renamed to `shortName` before validation (only if `shortName`
 * isn't already present), so un-migrated data still parses into the new shape.
 */
export const LabItemSchema = z.preprocess((val) => {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    if ('symbol' in o && !('shortName' in o)) {
      const { symbol, ...rest } = o;
      return { ...rest, shortName: symbol };
    }
  }
  return val;
}, LabItemObjectSchema);

export const DrawSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  labName: z.string(),
  sourceFile: z.string().optional(),
  items: z.array(LabItemSchema),
});

export const DrawsSchema = z.array(DrawSchema);

export type UnitValue = z.infer<typeof UnitValueSchema>;
export type CalculatedValue = z.infer<typeof CalculatedValueSchema>;
export type LabItem = z.infer<typeof LabItemSchema>;
export type Draw = z.infer<typeof DrawSchema>;

/**
 * Parse + validate raw draws (e.g. from JSON). Throws `ZodError` with a
 * precise path on malformed data.
 */
export function parseDraws(data: unknown): Draw[] {
  return DrawsSchema.parse(data);
}

/** Non-throwing variant — returns a discriminated result. */
export function safeParseDraws(data: unknown) {
  return DrawsSchema.safeParse(data);
}
