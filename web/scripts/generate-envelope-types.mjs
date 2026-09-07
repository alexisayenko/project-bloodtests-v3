import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../public/schema/bloodtests-3.schema.json');
const defaultOut = resolve(here, '../src/data/envelopeTypes.ts');

const bannerComment = `/* eslint-disable */
/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source schema: web/public/schema/bloodtests-3.schema.json
 * Generator:     web/scripts/generate-envelope-types.mjs
 * Regenerate:    npm run schema:types  (from web/)
 *
 * The committed copy is checked byte-for-byte by
 * web/test/envelope-types.test.ts, so a schema edit without a regeneration
 * fails CI.
 */`;

export async function generateEnvelopeTypes() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  return compile(schema, 'InterchangeEnvelope', {
    bannerComment,
    cwd: dirname(schemaPath),
    declareExternallyReferenced: true,
    enableConstEnums: false,
    additionalProperties: true,
    // Without this, `minItems: 1` becomes the tuple `[T, ...T[]]`, which no
    // `.map()` result can satisfy; the constraint stays enforced by ajv in
    // web/test/envelope-schema.test.ts.
    ignoreMinAndMaxItems: true,
    style: { singleQuote: true, printWidth: 100 },
  });
}

const outPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : defaultOut;
writeFileSync(outPath, await generateEnvelopeTypes(), 'utf8');
