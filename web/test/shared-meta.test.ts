import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  parseSharedMeta,
  panelAllowlist,
  isPanelVisible,
  visiblePanels,
  loadStoredSharedMeta,
  storeSharedMeta,
  SHARED_META_KEY,
} from '../src/data/sharedMeta';
import { fetchSharedMeta, fetchSharedData } from '../src/data/sharedLink';
import {
  ANALYSIS_SETTINGS_KEY,
  DEFAULT_ANALYSIS_SETTINGS,
  hasStoredAnalysisSettings,
  seedAnalysisSettings,
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
        settings: { unitSystem: 'us', sampleLimit: 'all', dateOrder: 'desc' },
      })
    ).toEqual({
      title: 'Alex labs',
      showPanels: ['Anemia', 'FBC'],
      settings: { unitSystem: 'us', sampleLimit: 'all', dateOrder: 'desc' },
    });
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
        settings: { unitSystem: 'metric', sampleLimit: -1, dateOrder: 'sideways' },
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

describe('hidden panel route fallback', () => {
  // Mirrors the guard in MedicalConditionsPage: a #panels/<name> hash pointing
  // at a hidden panel resolves to the panels grid instead.
  function resolve(hash: string, allow: string[] | null, panelsLoaded = true) {
    const name = hash.startsWith('#panels/') ? decodeURIComponent(hash.slice('#panels/'.length)) : null;
    if (!name) return 'panels';
    if (panelsLoaded && !isPanelVisible(name, allow)) return 'panels';
    return `panel:${name}`;
  }

  const allow = ['FBC', 'Anemia'];

  it('keeps a visible panel route', () => {
    expect(resolve('#panels/FBC', allow)).toBe('panel:FBC');
  });

  it('falls back to the grid for a hidden panel', () => {
    expect(resolve('#panels/Hypogonadism', allow)).toBe('panels');
  });

  it('keeps any panel route when there is no allowlist', () => {
    expect(resolve('#panels/Hypogonadism', null)).toBe('panel:Hypogonadism');
  });

  it('does not fall back before the panel catalog has loaded', () => {
    expect(resolve('#panels/Hypogonadism', allow, false)).toBe('panel:Hypogonadism');
  });
});

describe('meta settings seeding', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('seeds over the defaults when the visitor has nothing stored', () => {
    expect(hasStoredAnalysisSettings()).toBe(false);
    expect(seedAnalysisSettings({ unitSystem: 'us', sampleLimit: 'all' })).toEqual({
      ...DEFAULT_ANALYSIS_SETTINGS,
      unitSystem: 'us',
      sampleLimit: 'all',
    });
  });

  it('leaves the defaults alone when the meta carries no settings', () => {
    expect(seedAnalysisSettings(undefined)).toEqual(DEFAULT_ANALYSIS_SETTINGS);
  });

  it('does not seed once the visitor has their own stored choice', () => {
    localStorage.setItem(ANALYSIS_SETTINGS_KEY, JSON.stringify({ unitSystem: 'si', sampleLimit: 5, dateOrder: 'desc' }));
    expect(hasStoredAnalysisSettings()).toBe(true);
  });
});

describe('shared meta storage', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('round-trips a meta so a return visit keeps the same presentation', () => {
    storeSharedMeta({ showPanels: ['FBC'], settings: { dateOrder: 'desc' } });
    expect(loadStoredSharedMeta()).toEqual({ showPanels: ['FBC'], settings: { dateOrder: 'desc' } });
  });

  it('is null when nothing was stored or the stored value is corrupt', () => {
    expect(loadStoredSharedMeta()).toBeNull();
    localStorage.setItem(SHARED_META_KEY, '{not json');
    expect(loadStoredSharedMeta()).toBeNull();
  });
});
