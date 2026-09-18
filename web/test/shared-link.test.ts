import { describe, it, expect, beforeEach } from 'vitest';
import { readSharedDataGuid, isAlreadyImported, IMPORTED_LINKS_KEY, markImported } from '../src/data/sharedLink';
import { RESULTS_STORAGE_KEY } from '../src/data/resultsStorage';
import { makeSession } from './helpers/fixtures';
import { installMemoryStorage } from './helpers/storage';

const GUID = '85269e21-e47e-433d-9696-db5aaede4f18';

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

const SESSIONS = JSON.stringify([makeSession({ date: '2024-01-01', place: '', file: 'x' })]);

describe('isAlreadyImported', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('is false when the guid was never recorded', () => {
    localStorage.setItem(RESULTS_STORAGE_KEY, SESSIONS);
    expect(isAlreadyImported(GUID)).toBe(false);
  });

  it('is false when the ledger has the guid but the results store is empty', () => {
    markImported(GUID);
    expect(isAlreadyImported(GUID)).toBe(false);

    localStorage.setItem(RESULTS_STORAGE_KEY, '');
    expect(isAlreadyImported(GUID)).toBe(false);

    localStorage.setItem(RESULTS_STORAGE_KEY, '[]');
    expect(isAlreadyImported(GUID)).toBe(false);
  });

  it('is false when the results store is corrupt', () => {
    markImported(GUID);
    localStorage.setItem(RESULTS_STORAGE_KEY, '{not json');
    expect(isAlreadyImported(GUID)).toBe(false);
  });

  it('is false when the ledger itself is corrupt', () => {
    localStorage.setItem(IMPORTED_LINKS_KEY, '{not json');
    localStorage.setItem(RESULTS_STORAGE_KEY, SESSIONS);
    expect(isAlreadyImported(GUID)).toBe(false);
  });

  it('is true when the guid is recorded and the results store has data', () => {
    markImported(GUID);
    localStorage.setItem(RESULTS_STORAGE_KEY, SESSIONS);
    expect(isAlreadyImported(GUID)).toBe(true);
  });
});
