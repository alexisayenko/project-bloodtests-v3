import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { CHATBOT_PROMPT } from '../src/data/chatbotPrompt';
import { SCHEMA_VERSION } from '../src/data/envelopeSchema';

function exampleEnvelope(): unknown {
  const start = CHATBOT_PROMPT.indexOf('{\n  "schema"');
  const end = CHATBOT_PROMPT.indexOf('\n}\n', start) + 2;
  return JSON.parse(CHATBOT_PROMPT.slice(start, end));
}

describe('CHATBOT_PROMPT', () => {
  it('pins the envelope to the current schema version, as a string', () => {
    expect(CHATBOT_PROMPT).toContain(`"schema": "${SCHEMA_VERSION}"`);
    expect(CHATBOT_PROMPT).toMatch(/"schema": always the literal string "3\.2"[^\n]*string and not a number/);
  });

  it('shows an example envelope that is valid JSON and validates against the published schema', () => {
    const schema = JSON.parse(
      readFileSync(new URL('../public/schema/bloodtests-3.schema.json', import.meta.url), 'utf8')
    );
    const ajv = new Ajv2020({ allErrors: true });
    addFormats(ajv);
    const example = exampleEnvelope() as { schema: string; diagnosticReports: unknown[] };
    expect(example.schema).toBe(SCHEMA_VERSION);
    expect(example.diagnosticReports).toHaveLength(1);
    const validate = ajv.compile(schema);
    expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
  });

  it('names the top-level and per-report keys the parser reads', () => {
    for (const key of ['"diagnosticReports"', '"lab"', '"collectedAt"', '"observations"', '"identifiers"']) {
      expect(CHATBOT_PROMPT).toContain(key);
    }
    expect(CHATBOT_PROMPT).toMatch(/"identifiers"[^\n]*"visit" \/ "order" \/ "accession"/);
  });

  it('asks for the printed name under rawName, never name', () => {
    expect(CHATBOT_PROMPT).toMatch(/"rawName": the test name exactly as printed/);
    expect(CHATBOT_PROMPT).toMatch(/The key is "rawName", not "name"/);
    expect(CHATBOT_PROMPT).toMatch(/never translate them/);
  });

  it('asks for the unit exactly as printed and the value as a JSON number', () => {
    expect(CHATBOT_PROMPT).toMatch(/"unit": copied exactly as printed/);
    expect(CHATBOT_PROMPT).toMatch(/"value": the numeric result as a JSON number/);
    expect(CHATBOT_PROMPT).toMatch(/"rawValue": the result exactly as printed/);
  });

  it('forbids LOINC codes from the chatbot\'s own knowledge and fixes the empty-string fallback', () => {
    expect(CHATBOT_PROMPT).toMatch(/NEVER supply a code from your own knowledge/);
    expect(CHATBOT_PROMPT).toMatch(/set "loinc" to an empty string \(""\)/);
    expect(CHATBOT_PROMPT).toMatch(/always include the key, never omit it/);
  });

  it('keeps patient identifiers out of the file', () => {
    expect(CHATBOT_PROMPT).toMatch(/never a patient ID, medical record number, or national ID/);
    expect(CHATBOT_PROMPT).toMatch(/Never invent a test, value, unit, range, or code/);
  });

  it('points at the published schema and the production import page', () => {
    expect(CHATBOT_PROMPT).toContain('/schema/bloodtests-3.schema.json');
    expect(CHATBOT_PROMPT).toContain('https://paneloom.com');
  });
});
