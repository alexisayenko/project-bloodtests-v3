import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { contentHashOf, sha256Hex } from '../src/data/contentHash';

async function nativeHex(text: string): Promise<string> {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('sha256Hex', () => {
  it.each([
    '',
    'abc',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'a'.repeat(65),
    'Глюкоза 5,10 ммоль/л — Ελλάδα',
    JSON.stringify({ lab: 'Ygia', observations: Array.from({ length: 200 }, (_, i) => ({ v: i / 7 })) }),
  ])('matches crypto.subtle for %#', async (text) => {
    expect(sha256Hex(text)).toBe(await nativeHex(text));
  });
});

describe('contentHashOf', () => {
  it('is sha256: plus the hex of the compact JSON of the reports', async () => {
    const reports = [{ lab: 'Ygia', collectedAt: '2024-05-01T00:00:00Z', observations: [] }];
    expect(contentHashOf(reports)).toBe(`sha256:${await nativeHex(JSON.stringify(reports))}`);
  });
});
