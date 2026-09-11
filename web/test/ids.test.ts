import { afterEach, describe, expect, it, vi } from 'vitest';
import { newRowId } from '../src/data/ids';
import { parseMedications } from '../src/data/medications';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newRowId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses randomUUID where it exists', () => {
    const id = newRowId();
    expect(id).toMatch(UUID_V4);
    expect(newRowId()).not.toBe(id);
  });

  it('builds a v4 UUID from getRandomValues without randomUUID', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 50 }, () => newRowId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it('keeps ids stored in the old time-plus-random format loading', () => {
    const raw = JSON.stringify({ years: [2026], rows: [{ id: 'mf3k2a1b-0.4x9q2z', name: 'Vitamin D', dosage: '', months: [] }] });
    expect(parseMedications(raw, 2026).rows.map((r) => r.id)).toEqual(['mf3k2a1b-0.4x9q2z']);
  });
});
