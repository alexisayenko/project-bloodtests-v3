import { describe, it, expect, vi } from 'vitest';
import { loadViewSettings, saveViewSettings, VIEW_SETTINGS_KEY, DEFAULT_VIEW_SETTINGS } from '../src/data/storage/viewSettings';
import type { UnitSystem } from '../src/types';
import { installMemoryStorage } from './helpers/storage';

describe('loadViewSettings', () => {
  it('falls back to defaults when storage is unavailable', () => {
    // node environment: localStorage is undefined → the try/catch default path
    expect(loadViewSettings()).toEqual({ unitSystem: 'si', sampleLimit: 5, compactPanels: false });
  });

  const stored = (raw: string) => installMemoryStorage().set(VIEW_SETTINGS_KEY, raw);

  it('defaults compactPanels to false when missing or not a boolean true', () => {
    for (const raw of ['{"unitSystem":"us"}', '{"compactPanels":"yes"}', '{"compactPanels":1}', '{"compactPanels":false}']) {
      stored(raw);
      expect(loadViewSettings().compactPanels).toBe(false);
    }
    vi.unstubAllGlobals();
  });

  it('keeps a stored compactPanels choice', () => {
    stored('{"unitSystem":"si","sampleLimit":5,"compactPanels":true}');
    expect(loadViewSettings()).toEqual({ unitSystem: 'si', sampleLimit: 5, compactPanels: true });
    vi.unstubAllGlobals();
  });

  it('saves compactPanels through saveViewSettings, coercing a non-boolean to false', () => {
    const store = installMemoryStorage();
    saveViewSettings({ unitSystem: 'us', sampleLimit: 10, compactPanels: true });
    expect(JSON.parse(store.get(VIEW_SETTINGS_KEY)!)).toEqual({ unitSystem: 'us', sampleLimit: 10, compactPanels: true });
    expect(loadViewSettings().compactPanels).toBe(true);
    saveViewSettings({ unitSystem: 'us', sampleLimit: 10, compactPanels: 'on' as unknown as boolean });
    expect(loadViewSettings().compactPanels).toBe(false);
    vi.unstubAllGlobals();
  });

  it('gives a first-time visitor every default, sampleLimit included', () => {
    installMemoryStorage();
    expect(loadViewSettings()).toEqual(DEFAULT_VIEW_SETTINGS);
    expect(loadViewSettings().sampleLimit).toBe(5);
    vi.unstubAllGlobals();
  });

  it('keeps a stored choice and fills only what is missing', () => {
    stored('{"sampleLimit":"all"}');
    expect(loadViewSettings()).toEqual({ ...DEFAULT_VIEW_SETTINGS, sampleLimit: 'all' });
    vi.unstubAllGlobals();
  });

  it('ignores the retired dateOrder field a pre-existing payload still carries', () => {
    stored('{"unitSystem":"us","sampleLimit":10,"dateOrder":"desc"}');
    expect(loadViewSettings()).toEqual({ unitSystem: 'us', sampleLimit: 10, compactPanels: false });
    vi.unstubAllGlobals();
  });

  it('never hands out the shared defaults object', () => {
    installMemoryStorage();
    loadViewSettings().sampleLimit = 'all';
    expect(DEFAULT_VIEW_SETTINGS.sampleLimit).toBe(5);
    vi.unstubAllGlobals();
  });

  it('snaps a stored unit system and sample limit outside the allowed sets to their defaults', () => {
    stored('{"unitSystem":"metric","sampleLimit":20}');
    expect(loadViewSettings()).toEqual({ unitSystem: 'si', sampleLimit: 5, compactPanels: false });
    vi.unstubAllGlobals();
  });

  it('saves only an allowed unit system and sample limit, snapping anything else to the defaults', () => {
    const store = installMemoryStorage();
    saveViewSettings({ unitSystem: 'metric' as unknown as UnitSystem, sampleLimit: 20 as number, compactPanels: false });
    expect(JSON.parse(store.get(VIEW_SETTINGS_KEY)!)).toEqual({ unitSystem: 'si', sampleLimit: 5, compactPanels: false });
    vi.unstubAllGlobals();
  });
});
