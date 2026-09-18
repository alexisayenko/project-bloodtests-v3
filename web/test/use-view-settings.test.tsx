// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, useState } from 'react';
import { useViewSettings, type ViewSettingsState } from '../src/hooks/useViewSettings';
import type { SharedMeta } from '../src/data/sharedMeta';
import { VIEW_SETTINGS_KEY } from '../src/data/storage/viewSettings';
import { installMemoryStorage } from './helpers/storage';
import { mount, unmount } from './helpers/render';

let latest: ViewSettingsState;
let setMeta: (meta: SharedMeta | null) => void = () => {};
let store: Map<string, string>;

function Harness({ initial }: Readonly<{ initial: SharedMeta | null }>) {
  const [meta, set] = useState(initial);
  setMeta = set;
  latest = useViewSettings(meta);
  return null;
}

const stored = () => JSON.parse(store.get(VIEW_SETTINGS_KEY)!);
const setSharedMeta = (meta: SharedMeta | null) => act(async () => setMeta(meta));

beforeEach(() => {
  store = installMemoryStorage();
});

afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
});

describe('useViewSettings', () => {
  it('starts from the defaults and writes them to storage', async () => {
    await mount(<Harness initial={null} />);
    expect(latest.unitSystem).toBe('si');
    expect(latest.sampleLimit).toBe(5);
    expect(latest.compactPanels).toBe(false);
    expect(stored()).toEqual({ unitSystem: 'si', sampleLimit: 5, compactPanels: false });
  });

  it('starts from what is stored', async () => {
    store.set(VIEW_SETTINGS_KEY, JSON.stringify({ unitSystem: 'us', sampleLimit: 15, compactPanels: true }));
    await mount(<Harness initial={null} />);
    expect(latest.unitSystem).toBe('us');
    expect(latest.sampleLimit).toBe(15);
    expect(latest.compactPanels).toBe(true);
  });

  it('persists every change through its setters', async () => {
    await mount(<Harness initial={null} />);
    await act(async () => latest.setUnitSystem('us'));
    await act(async () => latest.setSampleLimit('all'));
    await act(async () => latest.setCompactPanels(true));
    expect(latest.unitSystem).toBe('us');
    expect(stored()).toEqual({ unitSystem: 'us', sampleLimit: 'all', compactPanels: true });
  });

  it('seeds the table controls from a share link when the visitor has nothing stored', async () => {
    await mount(<Harness initial={{ settings: { unitSystem: 'us', sampleLimit: 10 } }} />);
    expect(latest.unitSystem).toBe('us');
    expect(latest.sampleLimit).toBe(10);
    expect(latest.compactPanels).toBe(false);
  });

  it('seeds a share link that arrives after mount, judging "stored" as of the first render', async () => {
    await mount(<Harness initial={null} />);
    expect(latest.unitSystem).toBe('si');
    await setSharedMeta({ settings: { unitSystem: 'us', sampleLimit: 15 } });
    expect(latest.unitSystem).toBe('us');
    expect(latest.sampleLimit).toBe(15);
  });

  it('never overrides a visitor who already stored a choice', async () => {
    store.set(VIEW_SETTINGS_KEY, JSON.stringify({ unitSystem: 'si', sampleLimit: 5, compactPanels: false }));
    await mount(<Harness initial={{ settings: { unitSystem: 'us', sampleLimit: 10 } }} />);
    expect(latest.unitSystem).toBe('si');
    expect(latest.sampleLimit).toBe(5);
  });

  it('seeds one share link once, so a later change by the visitor sticks', async () => {
    const meta: SharedMeta = { settings: { unitSystem: 'us' } };
    await mount(<Harness initial={meta} />);
    await act(async () => latest.setUnitSystem('si'));
    await setSharedMeta(meta);
    expect(latest.unitSystem).toBe('si');
  });

  it('reload reads storage back after something else rewrote it', async () => {
    await mount(<Harness initial={null} />);
    store.set(VIEW_SETTINGS_KEY, JSON.stringify({ unitSystem: 'us', sampleLimit: 10, compactPanels: true }));
    await act(async () => latest.reload());
    expect(latest.unitSystem).toBe('us');
    expect(latest.sampleLimit).toBe(10);
    expect(latest.compactPanels).toBe(true);
  });

  it('reload falls back to the defaults after a clear', async () => {
    await mount(<Harness initial={null} />);
    await act(async () => latest.setUnitSystem('us'));
    store.clear();
    await act(async () => latest.reload());
    expect(latest.unitSystem).toBe('si');
  });
});
