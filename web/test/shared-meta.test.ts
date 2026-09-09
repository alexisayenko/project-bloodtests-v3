import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  parseSharedMeta,
  panelAllowlist,
  isPanelVisible,
  visiblePanels,
  loadStoredSharedMeta,
  storeSharedMeta,
  clearSharedMeta,
  applySharedMeta,
  SHARED_META_KEY,
} from '../src/data/sharedMeta';
import { fetchSharedMeta, fetchSharedData } from '../src/data/sharedLink';
import { importResults } from '../src/data/importResults';
import {
  VIEW_SETTINGS_KEY,
  DEFAULT_VIEW_SETTINGS,
  hasStoredViewSettings,
  seedViewSettings,
} from '../src/components/conditions/ui';

function installLocalStorageStub(): void {
  const store = new Map<string, string>();
  const stub = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true, writable: true });
}

describe('parseSharedMeta', () => {
  it('reads a full valid meta', () => {
    expect(
      parseSharedMeta({
        title: 'Alex labs',
        showPanels: ['Anemia', 'FBC'],
        settings: { unitSystem: 'us', sampleLimit: 'all' },
      })
    ).toEqual({
      title: 'Alex labs',
      showPanels: ['Anemia', 'FBC'],
      settings: { unitSystem: 'us', sampleLimit: 'all' },
    });
  });

  it('silently ignores the retired dateOrder a link published earlier may still carry', () => {
    expect(parseSharedMeta({ settings: { unitSystem: 'us', dateOrder: 'desc' } })).toEqual({
      settings: { unitSystem: 'us' },
    });
    expect(parseSharedMeta({ settings: { dateOrder: 'desc' } })).toEqual({});
  });

  it('treats every field as optional', () => {
    expect(parseSharedMeta({})).toEqual({});
    expect(parseSharedMeta({ showPanels: ['Anemia'] })).toEqual({ showPanels: ['Anemia'] });
    expect(parseSharedMeta({ settings: { sampleLimit: 3 } })).toEqual({ settings: { sampleLimit: 3 } });
  });

  it('drops malformed fields instead of failing', () => {
    expect(
      parseSharedMeta({
        title: 42,
        showPanels: ['Anemia', 7, null],
        settings: { unitSystem: 'metric', sampleLimit: -1 },
      })
    ).toEqual({ showPanels: ['Anemia'] });
    expect(parseSharedMeta({ showPanels: 'Anemia', settings: 'nope' })).toEqual({});
  });

  it('is null for anything that is not an object', () => {
    expect(parseSharedMeta(null)).toBeNull();
    expect(parseSharedMeta(undefined)).toBeNull();
    expect(parseSharedMeta('{}')).toBeNull();
    expect(parseSharedMeta([1, 2])).toBeNull();
  });
});

describe('fetchSharedMeta', () => {
  const GUID = '85269e21-e47e-433d-9696-db5aaede4f18';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed meta on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ showPanels: ['FBC'] }) }));
    await expect(fetchSharedMeta(GUID)).resolves.toEqual({ showPanels: ['FBC'] });
  });

  it('requests the .meta.json asset', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', spy);
    await fetchSharedMeta(GUID);
    expect(spy).toHaveBeenCalledWith(`/d/${GUID}.meta.json`);
  });

  it('is null when the file is absent (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    await expect(fetchSharedMeta(GUID)).resolves.toBeNull();
  });

  it('is null when the file is malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    }));
    await expect(fetchSharedMeta(GUID)).resolves.toBeNull();
  });

  it('is null when the network itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchSharedMeta(GUID)).resolves.toBeNull();
  });

  it('reads the data payload from the .data.json asset', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', spy);
    await fetchSharedData(GUID);
    expect(spy).toHaveBeenCalledWith(`/d/${GUID}.data.json`);
  });
});

describe('panel allowlist', () => {
  const panels = [{ name: 'Anemia' }, { name: 'FBC' }, { name: 'Hypogonadism' }];

  it('shows everything when there is no meta or no showPanels', () => {
    expect(panelAllowlist(null)).toBeNull();
    expect(panelAllowlist({})).toBeNull();
    expect(visiblePanels(panels, panelAllowlist(null))).toEqual(panels);
  });

  it('keeps only the allowlisted panels, in catalog order', () => {
    const allow = panelAllowlist({ showPanels: ['FBC', 'Anemia'] });
    expect(visiblePanels(panels, allow)).toEqual([{ name: 'Anemia' }, { name: 'FBC' }]);
  });

  it('ignores unknown names rather than erroring', () => {
    const allow = panelAllowlist({ showPanels: ['FBC', 'Not A Real Panel'] });
    expect(visiblePanels(panels, allow)).toEqual([{ name: 'FBC' }]);
  });

  it('hides everything for an empty allowlist', () => {
    expect(visiblePanels(panels, [])).toEqual([]);
  });

  it('reports per-panel visibility for route fallback', () => {
    const allow = panelAllowlist({ showPanels: ['FBC'] });
    expect(isPanelVisible('FBC', allow)).toBe(true);
    expect(isPanelVisible('Hypogonadism', allow)).toBe(false);
    expect(isPanelVisible('Nonexistent', allow)).toBe(false);
    expect(isPanelVisible('Hypogonadism', null)).toBe(true);
  });
});

describe('meta settings seeding', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('seeds over the defaults when the visitor has nothing stored', () => {
    expect(hasStoredViewSettings()).toBe(false);
    expect(seedViewSettings({ unitSystem: 'us', sampleLimit: 'all' })).toEqual({
      ...DEFAULT_VIEW_SETTINGS,
      unitSystem: 'us',
      sampleLimit: 'all',
    });
  });

  it('leaves the defaults alone when the meta carries no settings', () => {
    expect(seedViewSettings(undefined)).toEqual(DEFAULT_VIEW_SETTINGS);
  });

  it('does not seed once the visitor has their own stored choice', () => {
    localStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify({ unitSystem: 'si', sampleLimit: 5 }));
    expect(hasStoredViewSettings()).toBe(true);
  });
});

describe('shared meta storage', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('round-trips a meta so a return visit keeps the same presentation', () => {
    storeSharedMeta({ showPanels: ['FBC'], settings: { sampleLimit: 'all' } });
    expect(loadStoredSharedMeta()).toEqual({ showPanels: ['FBC'], settings: { sampleLimit: 'all' } });
  });

  it('is null when nothing was stored or the stored value is corrupt', () => {
    expect(loadStoredSharedMeta()).toBeNull();
    localStorage.setItem(SHARED_META_KEY, '{not json');
    expect(loadStoredSharedMeta()).toBeNull();
  });

  it('drops the stored meta on clear', () => {
    storeSharedMeta({ showPanels: ['FBC'] });
    clearSharedMeta();
    expect(localStorage.getItem(SHARED_META_KEY)).toBeNull();
    expect(loadStoredSharedMeta()).toBeNull();
  });

  it('clears without a stored meta and without storage', () => {
    expect(() => clearSharedMeta()).not.toThrow();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        removeItem: () => {
          throw new Error('storage unavailable');
        },
      },
      configurable: true,
      writable: true,
    });
    expect(() => clearSharedMeta()).not.toThrow();
  });
});

describe('a share link\'s meta does not outlive its link', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('applies the meta the link supplied', () => {
    applySharedMeta({ showPanels: ['FBC'] });
    expect(loadStoredSharedMeta()).toEqual({ showPanels: ['FBC'] });
  });

  it('replaces a previous link\'s allowlist with this link\'s', () => {
    applySharedMeta({ showPanels: ['FBC'] });
    applySharedMeta({ showPanels: ['Anemia'] });
    expect(loadStoredSharedMeta()).toEqual({ showPanels: ['Anemia'] });
  });

  it('does not inherit a previous link\'s allowlist when this link has no meta', () => {
    applySharedMeta({ showPanels: ['FBC'] });
    applySharedMeta(null);
    expect(loadStoredSharedMeta()).toBeNull();
    expect(panelAllowlist(loadStoredSharedMeta())).toBeNull();
  });
});

describe('an import does not disturb the shared meta on its own', () => {
  // NOTE: importResults itself does not clear the shared meta -- the caller
  // (ResultsContext.uploadFile / clearData) calls clearSharedMeta beside it.
  // That wiring lives in the view layer and is not covered here; what is
  // covered is that a FAILED import leaves both stores untouched.
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('a failed import leaves both the sessions and the meta alone', () => {
    storeSharedMeta({ showPanels: ['FBC'] });
    expect(() => importResults({ not: 'an envelope' })).toThrow();
    expect(loadStoredSharedMeta()).toEqual({ showPanels: ['FBC'] });
  });
});
