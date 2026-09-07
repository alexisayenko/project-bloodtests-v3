/**
 * The interchange envelope's `schema` version — see
 * `docs/tech/interchange-format.md`.
 *
 * 3 is the only version the app reads or writes. Files stamped with the
 * earlier 1 are converted offline with `npm run convert:v3`; see
 * `docs/tech/decisions/adr-0009-v3-only-and-rawname.md`.
 */
export const SCHEMA_VERSION = 3;

export function isAcceptedSchemaVersion(value: unknown): boolean {
  return value === SCHEMA_VERSION;
}
