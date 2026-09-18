import type { UnitSystem } from '../../types';

export const VIEW_SETTINGS_KEY = 'bloodtests_view_settings_v1';
export type ViewSettings = { unitSystem: UnitSystem; sampleLimit: number | 'all' };
type StoredViewSettings = ViewSettings & { compactPanels: boolean };
export const SAMPLE_LIMITS = [5, 10, 15, 'all'] as const;
export const DEFAULT_VIEW_SETTINGS: StoredViewSettings = {
  unitSystem: 'si',
  sampleLimit: 5,
  compactPanels: false,
};

function sampleLimitOf(value: unknown): number | 'all' {
  return SAMPLE_LIMITS.find((limit) => limit === value) ?? DEFAULT_VIEW_SETTINGS.sampleLimit;
}

export function loadViewSettings(): StoredViewSettings {
  try {
    const raw = localStorage.getItem(VIEW_SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredViewSettings>;
      return {
        unitSystem: stored.unitSystem === 'us' ? 'us' : 'si',
        sampleLimit: sampleLimitOf(stored.sampleLimit),
        compactPanels: stored.compactPanels === true,
      };
    }
  } catch {
    // corrupt/incompatible local storage -- ignore and start fresh
  }
  return { ...DEFAULT_VIEW_SETTINGS };
}

/** Persist the shared table controls and the Compact view preference, dropping any value outside the accepted set. */
export function saveViewSettings(settings: ViewSettings & { compactPanels?: boolean }): void {
  const { unitSystem, sampleLimit, compactPanels } = settings;
  const safe: StoredViewSettings = {
    unitSystem: unitSystem === 'us' ? 'us' : 'si',
    sampleLimit: sampleLimitOf(sampleLimit),
    compactPanels: compactPanels === true,
  };
  try {
    localStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify(safe));
  } catch {
    // storage unavailable (private browsing, quota) -- setting just won't persist
  }
}

/** Whether the visitor already made their own choice -- share-link settings only seed when they haven't. */
export function hasStoredViewSettings(): boolean {
  try {
    return localStorage.getItem(VIEW_SETTINGS_KEY) !== null;
  } catch {
    return false;
  }
}

/** Share-link settings applied over the defaults: a starting point, never an override. */
export function seedViewSettings(seed: Partial<ViewSettings> | undefined): StoredViewSettings {
  return { ...DEFAULT_VIEW_SETTINGS, ...seed };
}
