// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResultsTable } from '../src/components/conditions/ResultTables';
import { PopupProvider, type PopupApi } from '../src/components/conditions/PopupContext';
import { SchedulingProvider, type SchedulingApi } from '../src/components/conditions/SchedulingContext';
import type { Observation } from '../src/components/conditions/markers';
import { mount, unmount } from './helpers/render';

function fakeMatchMedia() {
  return {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

const popupApi: PopupApi = {
  popup: null,
  closePopup: () => {},
  openPopup: () => {},
  openIndexPopup: () => {},
  openResultPopup: () => {},
  openIndexResultPopup: () => {},
  selectedLoinc: null,
  onSelect: () => {},
  selectedCell: null,
  onSelectCell: () => {},
};

const schedulingApi: SchedulingApi = {
  sortedVisits: [],
  rowSchedulings: [],
  indexSchedulings: [],
  onAddVisit: () => {},
  onRemoveVisit: () => {},
  onSetMonth: () => {},
  onSelectLab: () => {},
};

const test = (loinc: string, section?: string): Observation => ({
  shortName: loinc,
  friendlyName: loinc,
  longCommonName: '',
  loinc,
  section,
});

async function renderTable(rows: Observation[], indices: Observation[] = []) {
  const container = await mount(
    <PopupProvider value={popupApi}>
      <SchedulingProvider value={schedulingApi}>
        <ResultsTable rows={rows} indices={indices} visibleDates={[]} allResults={[]} unitSystem="si" />
      </SchedulingProvider>
    </PopupProvider>
  );
  return [...container.querySelectorAll('tbody tr')].map((tr) => ({
    isDivider: tr.querySelector('th[scope="rowgroup"]') !== null,
    label: tr.querySelector('th')?.textContent ?? '',
  }));
}

describe('ResultsTable section dividers', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', fakeMatchMedia);
  });

  afterEach(() => {
    unmount();
    vi.unstubAllGlobals();
  });

  it('renders a divider before each of FBC\'s three sections, in order', async () => {
    const rows = await renderTable([
      test('a', 'Leukocytes and Differentials'),
      test('b', 'Leukocytes and Differentials'),
      test('c', 'Erythrocytes'),
      test('d', 'Platelets'),
    ]);
    const dividers = rows.filter((r) => r.isDivider).map((r) => r.label);
    expect(dividers).toEqual(['Leukocytes and Differentials', 'Erythrocytes', 'Platelets']);
    expect(rows).toHaveLength(7); // 3 dividers + 4 observation rows
  });

  it('renders no dividers for a panel without sections', async () => {
    const rows = await renderTable([test('a'), test('b'), test('c')]);
    expect(rows.filter((r) => r.isDivider)).toHaveLength(0);
    expect(rows).toHaveLength(3);
  });

  it('keeps the Indices divider working alongside the new per-section dividers', async () => {
    const rows = await renderTable(
      [test('a', 'Leukocytes and Differentials'), test('b', 'Erythrocytes')],
      [test('idx')]
    );
    const dividers = rows.filter((r) => r.isDivider).map((r) => r.label);
    expect(dividers).toEqual(['Leukocytes and Differentials', 'Erythrocytes', 'Indices']);
  });
});
