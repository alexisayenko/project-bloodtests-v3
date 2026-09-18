import { createContext, useContext, useState, type ReactNode } from 'react';
import type { IndexDef } from '../../data/computedIndices';
import type { Observation } from './markers';
import type { Route } from './routing';
import type { ResultEntry } from './resultsLookup';
import type { SelectedCell } from './resultCells';
import { INDEX_POPUP_WIDTH, POPUP_WIDTH, popupPosition } from './popupGeometry';

export type PopupPosition = { left: number; width: number; top?: number; bottom?: number };
export type PopupState =
  | ({ kind: 'observation'; test: Observation } & PopupPosition)
  | ({ kind: 'index'; def: IndexDef } & PopupPosition)
  | ({ kind: 'result'; test: Observation; entry: ResultEntry } & PopupPosition)
  | ({ kind: 'indexResult'; def: IndexDef; date: string; value: number } & PopupPosition);

type Anchor = { currentTarget: HTMLElement };

/** A popup's own content, before the opener anchors it to the clicked element. */
type PopupPayload = {
  [K in PopupState['kind']]: Omit<Extract<PopupState, { kind: K }>, keyof PopupPosition>;
}[PopupState['kind']];

export type PopupApi = {
  popup: PopupState | null;
  closePopup: () => void;
  openPopup: (test: Observation, e: Anchor) => void;
  openIndexPopup: (def: IndexDef, e: Anchor) => void;
  openResultPopup: (test: Observation, entry: ResultEntry, e: Anchor) => void;
  openIndexResultPopup: (def: IndexDef, date: string, value: number, e: Anchor) => void;
  selectedLoinc: string | null;
  onSelect: (loinc: string) => void;
  /** Which single (row, date) data cell is armed for a second click to open. */
  selectedCell: SelectedCell;
  onSelectCell: (loinc: string, date: string) => void;
};

const PopupContext = createContext<PopupApi | null>(null);

/** Popup and selection state for the whole shell; a popup never survives navigation, so it closes on every new route. */
export function usePopupState(route: Route): PopupApi {
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [selectedLoinc, setSelectedLoinc] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);

  // Adjusted during render, so the new route never paints under an old popup.
  const [popupRoute, setPopupRoute] = useState(route);
  if (route !== popupRoute) {
    setPopupRoute(route);
    setPopup(null);
  }

  const openFrom = (payload: PopupPayload, e: Anchor) => {
    const width = payload.kind === 'index' ? INDEX_POPUP_WIDTH : POPUP_WIDTH;
    setPopup({ ...payload, ...popupPosition(e.currentTarget.getBoundingClientRect(), width) });
  };

  return {
    popup,
    closePopup: () => setPopup(null),
    openPopup: (test, e) => openFrom({ kind: 'observation', test }, e),
    openIndexPopup: (def, e) => openFrom({ kind: 'index', def }, e),
    openResultPopup: (test, entry, e) => openFrom({ kind: 'result', test, entry }, e),
    openIndexResultPopup: (def, date, value, e) => openFrom({ kind: 'indexResult', def, date, value }, e),
    selectedLoinc,
    onSelect: setSelectedLoinc,
    selectedCell,
    onSelectCell: (loinc, date) => setSelectedCell({ loinc, date }),
  };
}

export function PopupProvider({ value, children }: Readonly<{ value: PopupApi; children: ReactNode }>) {
  return <PopupContext.Provider value={value}>{children}</PopupContext.Provider>;
}

export function usePopupContext(): PopupApi {
  const api = useContext(PopupContext);
  if (!api) throw new Error('usePopupContext needs a PopupProvider above it');
  return api;
}
