/**
 * The interchange envelope's `schema` version — see
 * `docs/tech/interchange-format.md`.
 *
 * The version is the string `"major.minor"`. The major answers the reader's
 * one question — can I read this? — and only a breaking change bumps it. The
 * minor is bumped on every other change to the envelope format, each of which
 * is a backward-compatible addition, so a `3.0` file still loads here and a
 * later `3.2` file loads under this build: unknown fields are ignored.
 *
 * A string rather than a number because JSON cannot tell `3.10` from `3.1`.
 * The bare number `3` is the one legacy spelling still read, as `3.0`; the
 * bare string `"3"` is not, since the string form always carries a minor.
 *
 * Major 3 is the only one read or written: see
 * `docs/tech/decisions/adr-0009-v3-only-and-rawname.md`, widened from `3` to
 * `3.x` by `adr-0012-envelope-version-is-a-major-minor-string.md`. Files
 * stamped with the earlier 1 are converted offline with `npm run convert:v3`.
 */
export const SCHEMA_MAJOR = 3;

/** What this build writes. Bumped on every change to the envelope format. */
export const SCHEMA_VERSION = `${SCHEMA_MAJOR}.1`;

/** The one legacy spelling: the bare number 3, read as `3.0`. */
const LEGACY_NUMERIC_VERSION = SCHEMA_MAJOR;

const ACCEPTED_VERSION = new RegExp(String.raw`^${SCHEMA_MAJOR}\.(0|[1-9][0-9]*)$`);

export function isAcceptedSchemaVersion(value: unknown): boolean {
  if (value === LEGACY_NUMERIC_VERSION) return true;
  return typeof value === 'string' && ACCEPTED_VERSION.test(value);
}
