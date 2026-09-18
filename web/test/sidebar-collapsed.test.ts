import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SIDEBAR_COLLAPSED_KEY,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
} from '../src/data/storage/sidebarCollapsed';

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    has: (key: string) => store.has(key),
  };
}

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sidebar collapsed preference', () => {
  it('reads as expanded when nothing is stored', () => {
    expect(loadSidebarCollapsed()).toBe(false);
  });

  it('stores a collapse as the literal "true" under its own key', () => {
    saveSidebarCollapsed(true);
    expect(storage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('true');
    expect(loadSidebarCollapsed()).toBe(true);
  });

  it('removes the key on expand rather than storing "false"', () => {
    saveSidebarCollapsed(true);
    saveSidebarCollapsed(false);
    expect(storage.has(SIDEBAR_COLLAPSED_KEY)).toBe(false);
    expect(loadSidebarCollapsed()).toBe(false);
  });

  it('treats any stored value other than "true" as expanded', () => {
    storage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    expect(loadSidebarCollapsed()).toBe(false);
  });

  it('survives storage that throws, reading as expanded and saving nothing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadSidebarCollapsed()).toBe(false);
    expect(() => saveSidebarCollapsed(true)).not.toThrow();
    expect(() => saveSidebarCollapsed(false)).not.toThrow();
  });
});
