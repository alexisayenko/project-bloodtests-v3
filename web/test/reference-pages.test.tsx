// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { ReferenceBookPage } from '../src/components/conditions/ReferenceBookPage';
import { makeEntry } from './helpers/fixtures';
import { mount, unmount } from './helpers/render';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../src/data/DataContext', () => ({
  useData: () => ({ analysesCatalog: {}, panels: [], monitoringPanels: [], loading: false }),
}));

const navigate = vi.fn();

async function open(indexKey?: string) {
  const el = await mount(
    <ReferenceBookPage indexKey={indexKey} navigate={navigate} allResults={[makeEntry({ loinc: '718-7', date: '2026-03-03', place: 'Lab A', result: { value: 14.2 } })]} />
  );
  const deadline = Date.now() + 5000;
  while (el.textContent?.includes('Loading…') && Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  return el;
}

const heading = (el: HTMLElement) => el.querySelector('h1')?.textContent ?? '';

afterEach(unmount);

describe('ReferenceBookPage', () => {
  it('lists every section on the index', async () => {
    const el = await open();
    const text = el.textContent ?? '';
    for (const label of ['HP Axis', 'Testosterone', 'Mass ↔ molar conversion', 'Units and how they are read', 'LOINC database', 'FSH', 'HOMA-IR']) {
      expect(text).toContain(label);
    }
  });

  it('renders an index detail with its formula and references', async () => {
    const el = await open('homair');
    expect(heading(el)).toContain('HOMA-IR');
    expect(el.textContent).toContain('References');
    expect(el.textContent).toContain('Optimal (green) zone');
  });

  it('renders the HP Axis cascades', async () => {
    const el = await open('hp-axis');
    expect(heading(el)).toBe('HP Axis');
    expect(el.textContent).toContain('Prolactin (PRL)');
  });

  it('renders the molar-mass table', async () => {
    const el = await open('molar-masses');
    expect(heading(el)).toBe('Mass ↔ molar conversion');
    expect(el.textContent).toContain('Atomic weights');
    expect(el.textContent).toContain('Cholesterol');
  });

  it('renders the units page with its computed tables', async () => {
    const el = await open('units');
    expect(heading(el)).toBe('Units and how they are read');
    expect(el.textContent).toContain('When U and IU are one unit');
    expect(el.textContent).toContain('one unit');
  });

  it('renders the FSH page with its attributed figures', async () => {
    const el = await open('fsh');
    expect(heading(el)).toBe('FSH');
    expect(el.querySelectorAll('img')).toHaveLength(2);
    expect(el.textContent).toContain('1XWD');
  });

  it('renders the LOINC database with a last-tested reading', async () => {
    const el = await open('loinc-database');
    expect(heading(el)).toBe('LOINC database');
    expect(el.textContent).toContain('Hemoglobin');
    expect(el.textContent).toContain('Mar 26');
  });

  it('renders the Testosterone page', async () => {
    const el = await open('testosterone');
    expect(heading(el)).toContain('Testosterone');
    expect(el.textContent).toContain('Clomiphene');
  });
});
