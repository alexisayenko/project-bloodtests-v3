// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HormonalPathwaysView } from '../src/components/conditions/HormonalPathwaysView';
import { LipidTransportView } from '../src/components/conditions/LipidTransportView';
import type { Observation } from '../src/components/conditions/markers';
import type { ResultEntry } from '../src/components/conditions/resultsLookup';
import { formatMonthYear } from '../src/data/months';
import type { Result } from '../src/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  if (!('fonts' in document)) {
    Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
  }
});

type View = typeof HormonalPathwaysView | typeof LipidTransportView;

function reading(loinc: string, value: number, unit: string, refMin: number | null = null, refMax: number | null = null): Result {
  return { loinc, rawName: loinc, section: '', value, rawValue: String(value), valueQualifier: '', unit, refText: '', refMin, refMax, method: '' };
}

const entry = (date: string, result: Result): ResultEntry => ({ loinc: result.loinc, date, place: 'Synthetic Lab', result });

function byDate(entries: readonly ResultEntry[]): Record<string, Record<string, Result>> {
  const map: Record<string, Record<string, Result>> = {};
  for (const { date, loinc, result } of entries) (map[date] ??= {})[loinc] = result;
  return map;
}

const observation = (loinc: string, shortName: string): Observation => ({ loinc, shortName, friendlyName: shortName, longCommonName: shortName });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mount(Component: View, entries: readonly ResultEntry[], panelTests: readonly Observation[]): Promise<HTMLDivElement> {
  function Harness() {
    const [unitSystem, setUnitSystem] = useState<'si' | 'us'>('si');
    return <Component allResults={entries} resultsByDate={byDate(entries)} panelTests={panelTests} unitSystem={unitSystem} onUnitSystemChange={setUnitSystem} />;
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness />);
  });
  return container;
}

const q = (el: ParentNode, selector: string) => {
  const found = el.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`nothing matches ${selector}`);
  return found;
};

const buttonNamed = (el: ParentNode, name: string) => {
  const found = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name);
  if (!found) throw new Error(`no button ${name}`);
  return found;
};

const click = (el: HTMLElement) => act(async () => el.click());

const chipValue = (el: ParentNode, id: string) => q(el, `[data-caption="${id}"] .mc-pathway-node-value`).textContent ?? '';

async function selectOption(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const pressEscape = () => act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

// ---- Hormonal Pathways ----

const HYPOGONADISM_TESTS = [
  observation('14913-8', 'T'),
  observation('2942-1', 'SHBG'),
  observation('1751-7', 'ALB'),
  observation('10501-5', 'LH'),
  observation('2243-4', 'E2'),
];

const EARLIER = '2025-03-10';
const LATEST = '2026-01-15';

const HORMONE_RESULTS: ResultEntry[] = [
  entry(EARLIER, reading('14913-8', 15, 'nmol/L', 8.6, 29)),
  entry(LATEST, reading('14913-8', 20, 'nmol/L', 8.6, 29)),
  entry(LATEST, reading('13967-5', 40, 'nmol/L')),
  entry(LATEST, reading('1751-7', 4.5, 'g/dL')),
  entry(LATEST, reading('10501-5', 5, 'mIU/mL')),
  entry(LATEST, reading('2243-4', 25, 'pg/mL')),
];

describe('HormonalPathwaysView', () => {
  it('renders zones, badges and the illustrative note with grey dashes when there is no data', async () => {
    const el = await mount(HormonalPathwaysView, [], HYPOGONADISM_TESTS);
    const zones = [...el.querySelectorAll('.mc-pathway-band h2')].map((h) => h.textContent);
    expect(zones).toEqual(['Brain', 'Blood Transport', 'Testes', 'Target tissues']);
    expect([...el.querySelectorAll('.mc-pathway-badge-name')].map((b) => b.textContent)).toEqual([
      'Total Testosterone',
      'Bioavailable Testosterone',
      'Free Testosterone',
      'T/LH',
      'DHT/T',
      'T/E2',
    ]);
    expect([...el.querySelectorAll('.mc-pathway-badge-value')].every((v) => v.textContent === '–')).toBe(true);
    expect(q(el, '.mc-pathway-art-note').textContent).toMatch(/brain and cell images are illustrative/i);
    for (const id of ['fsh', 'lh', 't', 'shbg', 'alb', 'shbg-t', 'alb-t', 'dht']) {
      expect(chipValue(el, id)).toBe('–');
      expect(el.querySelector(`[data-caption="${id}"] .mc-pathway-dot-none`)).not.toBeNull();
    }
    expect(q(el, '.mc-pathway-stepper-label').textContent).toBe('–');
  });

  it('steps through the panel dates, defaulting to the latest', async () => {
    const el = await mount(HormonalPathwaysView, HORMONE_RESULTS, HYPOGONADISM_TESTS);
    const label = () => q(el, '.mc-pathway-stepper-label').textContent;
    expect(label()).toBe(formatMonthYear(LATEST));
    expect((q(el, '[aria-label="Next date"]') as HTMLButtonElement).disabled).toBe(true);
    await click(q(el, '[aria-label="Previous date"]'));
    expect(label()).toBe(formatMonthYear(EARLIER));
    expect((q(el, '[aria-label="Previous date"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a chip in SI and switches its unit when the unit system changes', async () => {
    const el = await mount(HormonalPathwaysView, HORMONE_RESULTS, HYPOGONADISM_TESTS);
    expect(chipValue(el, 'e2')).toMatch(/pmol\/L/);
    expect(chipValue(el, 'alb')).toMatch(/^45 g\/L/);
    await click(buttonNamed(el, 'US'));
    expect(chipValue(el, 'e2')).toMatch(/^25 pg\/mL/);
    expect(chipValue(el, 'alb')).toMatch(/^4\.5 g\/dL/);
  });

  it('shows each bound pool with its share of total testosterone', async () => {
    const el = await mount(HormonalPathwaysView, HORMONE_RESULTS, HYPOGONADISM_TESTS);
    for (const id of ['shbg-t', 'alb-t']) {
      expect(q(el, `[data-caption="${id}"] .mc-pathway-share`).textContent).toMatch(/^\d+(\.\d+)?%$/);
    }
  });

  it('recomputes free testosterone when the molar mass changes', async () => {
    const el = await mount(HormonalPathwaysView, HORMONE_RESULTS, HYPOGONADISM_TESTS);
    const before = chipValue(el, 't');
    expect(before).toMatch(/pmol\/L/);
    const select = [...el.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'issam'));
    await selectOption(select!, 'issam');
    expect(chipValue(el, 't')).not.toBe(before);
  });

  it('expands a badge to its reference range and closes it on Escape', async () => {
    const el = await mount(HormonalPathwaysView, HORMONE_RESULTS, HYPOGONADISM_TESTS);
    const toggle = q(el, '[data-badge="total-t"] .mc-pathway-badge-toggle');
    await click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '[data-badge="total-t"] .mc-pathway-ref-head').textContent).toMatch(/Reference range/);
    await pressEscape();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[data-badge="total-t"] .mc-pathway-ref')).toBeNull();
  });
});

// ---- Lipid Transport ----

const CARDIO_TESTS = [observation('2093-3', 'TC'), observation('2085-9', 'HDL-C'), observation('2571-8', 'TRIG'), observation('13457-7', 'LDL-C')];

const LIPID_EARLIER = '2025-06-02';
const LIPID_LATEST = '2026-02-01';

const LIPID_RESULTS: ResultEntry[] = [
  entry(LIPID_EARLIER, reading('2093-3', 190, 'mg/dL', null, 200)),
  entry(LIPID_LATEST, reading('2093-3', 200, 'mg/dL', null, 200)),
  entry(LIPID_LATEST, reading('2085-9', 50, 'mg/dL', 40, null)),
  entry(LIPID_LATEST, reading('2571-8', 150, 'mg/dL', null, 150)),
];

describe('LipidTransportView', () => {
  it('renders the liver, badges and the illustrative note with grey dashes when there is no data', async () => {
    const el = await mount(LipidTransportView, [], CARDIO_TESTS);
    expect(el.querySelector('[data-node="liver"]')).not.toBeNull();
    expect(el.querySelectorAll('[data-badge]')).toHaveLength(10);
    expect([...el.querySelectorAll('.mc-pathway-badge-value')].every((v) => v.textContent === '–')).toBe(true);
    expect(q(el, '.mc-pathway-art-note').textContent).toMatch(/illustrative/);
  });

  it('steps through the panel dates, defaulting to the latest', async () => {
    const el = await mount(LipidTransportView, LIPID_RESULTS, CARDIO_TESTS);
    expect(q(el, '.mc-pathway-stepper-label').textContent).toBe(formatMonthYear(LIPID_LATEST));
    await click(q(el, '[aria-label="Previous date"]'));
    expect(q(el, '.mc-pathway-stepper-label').textContent).toBe(formatMonthYear(LIPID_EARLIER));
  });

  it('shows a badge value in SI and switches its unit when the unit system changes', async () => {
    const el = await mount(LipidTransportView, LIPID_RESULTS, CARDIO_TESTS);
    const value = () => q(el, '[data-badge="tc"] .mc-pathway-badge-value').textContent ?? '';
    expect(value()).toMatch(/mmol\/L/);
    await click(buttonNamed(el, 'US'));
    expect(value()).toBe('200 mg/dL');
  });

  it('renders VLDL as a holder apoprotein carrying its two cargo chips, cholesterol drawn larger than triglyceride', async () => {
    const el = await mount(LipidTransportView, [], CARDIO_TESTS);
    const diagram = q(el, '[data-node="vldl"]');
    const labels = [...diagram.querySelectorAll('.mc-pathway-node-label')].map((l) => l.textContent);
    expect(labels).toEqual(['TRIG', 'ApoB-100', 'Chol', 'VLDL']);
    const bubbles = diagram.querySelectorAll('.mc-pathway-bubble');
    expect(bubbles).toHaveLength(2);
    const trigWidth = Number(bubbles[0].querySelector('svg')!.getAttribute('width'));
    const cholWidth = Number(bubbles[1].querySelector('svg')!.getAttribute('width'));
    expect(cholWidth).toBeGreaterThan(trigWidth);
  });

  it('falls back to Martin-Hopkins on the LDL-C badge when the lab reported no LDL-C', async () => {
    const el = await mount(LipidTransportView, LIPID_RESULTS, CARDIO_TESTS);
    await click(buttonNamed(el, 'US'));
    const value = q(el, '[data-badge="ldl"] .mc-pathway-badge-value');
    expect(value.querySelector('.mc-lipid-calc')).not.toBeNull();
    expect(value.textContent).toMatch(/^\d+(\.\d+)? mg\/dL/);
  });

  it('expands a badge to its reference range and closes it on Escape', async () => {
    const el = await mount(LipidTransportView, LIPID_RESULTS, CARDIO_TESTS);
    const toggle = q(el, '[data-badge="tc"] .mc-pathway-badge-toggle');
    await click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '[data-badge="tc"] .mc-pathway-ref-head').textContent).toMatch(/Reference range/);
    await pressEscape();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[data-badge="tc"] .mc-pathway-ref')).toBeNull();
  });
});
