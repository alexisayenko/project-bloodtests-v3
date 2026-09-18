// `"major.minor"` as a string because JSON cannot tell `3.10` from `3.1`; only
// a breaking change bumps the major, so any `3.x` is read (ADR-0012).
export const SCHEMA_MAJOR = 3;

/** What this build writes; bump the minor on every envelope change. */
export const SCHEMA_VERSION = `${SCHEMA_MAJOR}.1`;

// The bare number 3 is read as `3.0`; the bare string "3" is not.
const LEGACY_NUMERIC_VERSION = SCHEMA_MAJOR;

const ACCEPTED_VERSION = new RegExp(String.raw`^${SCHEMA_MAJOR}\.(0|[1-9][0-9]*)$`);

export function isAcceptedSchemaVersion(value: unknown): boolean {
  if (value === LEGACY_NUMERIC_VERSION) return true;
  return typeof value === 'string' && ACCEPTED_VERSION.test(value);
}
