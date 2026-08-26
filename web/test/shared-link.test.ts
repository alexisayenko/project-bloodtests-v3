import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readSharedDataGuid } from '../src/data/sharedLink';
import { parseUploadedResults } from '../src/data/parseUpload';

const GUID = '85269e21-e47e-433d-9696-db5aaede4f18';
const dataFile = fileURLToPath(new URL(`../public/d/${GUID}.json`, import.meta.url));

describe('readSharedDataGuid', () => {
  it('accepts a valid guid', () => {
    expect(readSharedDataGuid(`?data=${GUID}`)).toBe(GUID);
    expect(readSharedDataGuid(`?foo=1&data=${GUID}&bar=2`)).toBe(GUID);
  });

  it('rejects anything that is not a guid', () => {
    expect(readSharedDataGuid('')).toBeNull();
    expect(readSharedDataGuid('?data=')).toBeNull();
    expect(readSharedDataGuid('?data=not-a-guid')).toBeNull();
    expect(readSharedDataGuid(`?data=${GUID}x`)).toBeNull();
    expect(readSharedDataGuid('?data=../../etc/passwd')).toBeNull();
    expect(readSharedDataGuid('?other=1')).toBeNull();
  });
});

describe('shared data file', () => {
  it.skipIf(!existsSync(dataFile))('parses into the expected sessions and observations', () => {
    const json: unknown = JSON.parse(readFileSync(dataFile, 'utf8'));
    const sessions = parseUploadedResults(json);
    expect(sessions).toHaveLength(10);
    expect(sessions.reduce((n, s) => n + s.items.length, 0)).toBe(178);
  });
});
