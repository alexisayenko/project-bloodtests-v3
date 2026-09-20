// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DiagnosticReportDetailView } from '../src/components/conditions/DiagnosticReportDetailView';
import type { DiagnosticReport, Result } from '../src/types';
import { makeResult } from './helpers/fixtures';

vi.mock('../src/data/DataContext', () => ({
  useData: () => ({ analysesCatalog: {}, panels: [], monitoringPanels: [], loading: false }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mchc = (overrides: Partial<Result> = {}): Result =>
  makeResult({ loinc: '786-4', rawName: 'MCHC', value: 34, rawValue: '34', unit: '%', refMin: 32, refMax: 36, ...overrides });

const groupOf = (items: Result[]): DiagnosticReport => ({ date: '2026-05-01', place: 'Lab A', file: 'r1', items, itemCount: items.length });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(items: Result[], onUpdateGroup = vi.fn()) {
  const group = groupOf(items);
  act(() => root.render(<DiagnosticReportDetailView group={group} loadGroupItems={async () => items} onBack={() => {}} onUpdateGroup={onUpdateGroup} />));
  return onUpdateGroup;
}

const unitInput = () => container.querySelectorAll<HTMLInputElement>('tbody input')[2]!;
const notes = () => [...container.querySelectorAll('[data-testid="printed-unit"]')].map((n) => n.textContent);

describe('report detail Unit cell', () => {
  it('shows the stored unit with the printed unit as a note', () => {
    mount([mchc({ storedUnit: 'g/dL' })]);
    expect(unitInput().value).toBe('g/dL');
    expect(notes()).toEqual(['printed: %']);
  });

  it('shows the printed unit and no note without a stored unit', () => {
    mount([mchc()]);
    expect(unitInput().value).toBe('%');
    expect(notes()).toEqual([]);
  });

  it('shows no note when the stored and printed units are identical', () => {
    mount([mchc({ unit: 'g/dL', storedUnit: 'g/dL' })]);
    expect(unitInput().value).toBe('g/dL');
    expect(notes()).toEqual([]);
  });

  it('saves an edit of the shown unit into the stored unit and keeps the printed one', () => {
    const onUpdateGroup = mount([mchc({ storedUnit: 'g/dL' })]);
    const input = unitInput();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input, 'g/L');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(unitInput().value).toBe('g/L');
    expect(notes()).toEqual(['printed: %']);
    const save = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Save')!;
    act(() => save.click());
    const saved = onUpdateGroup.mock.calls[0]![1] as DiagnosticReport;
    expect(saved.items![0]).toMatchObject({ unit: '%', storedUnit: 'g/L', value: 34, rawValue: '34' });
  });
});
