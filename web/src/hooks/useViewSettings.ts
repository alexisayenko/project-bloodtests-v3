import { useEffect, useState } from 'react';
import type { UnitSystem } from '../types';
import type { SharedMeta } from '../data/sharedMeta';
import { hasStoredViewSettings, loadViewSettings, saveViewSettings, seedViewSettings } from '../data/storage/viewSettings';

export type ViewSettingsState = {
  unitSystem: UnitSystem;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  sampleLimit: number | 'all';
  setSampleLimit: (sampleLimit: number | 'all') => void;
  compactPanels: boolean;
  setCompactPanels: (compact: boolean) => void;
  /** A clear or restore rewrites storage underneath this state, so it has to be read back. */
  reload: () => void;
};

/** The persisted table controls and Compact view preference, seeded once from a share link when the visitor has none stored. */
export function useViewSettings(sharedMeta: SharedMeta | null): ViewSettingsState {
  const [initialSettings] = useState(loadViewSettings);
  const [hadStoredSettings] = useState(hasStoredViewSettings);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(initialSettings.unitSystem);
  const [sampleLimit, setSampleLimit] = useState<number | 'all'>(initialSettings.sampleLimit);
  const [compactPanels, setCompactPanels] = useState(initialSettings.compactPanels);

  useEffect(() => {
    saveViewSettings({ unitSystem, sampleLimit, compactPanels });
  }, [unitSystem, sampleLimit, compactPanels]);

  // Adjusted during render so the first paint uses the seed.
  const [seededFrom, setSeededFrom] = useState<SharedMeta | null>(null);
  if (!hadStoredSettings && sharedMeta?.settings && sharedMeta !== seededFrom) {
    const seeded = seedViewSettings(sharedMeta.settings);
    setSeededFrom(sharedMeta);
    setUnitSystem(seeded.unitSystem);
    setSampleLimit(seeded.sampleLimit);
  }

  const reload = () => {
    const stored = loadViewSettings();
    setUnitSystem(stored.unitSystem);
    setSampleLimit(stored.sampleLimit);
    setCompactPanels(stored.compactPanels);
  };

  return { unitSystem, setUnitSystem, sampleLimit, setSampleLimit, compactPanels, setCompactPanels, reload };
}
