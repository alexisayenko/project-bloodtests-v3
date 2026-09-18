import { clamp } from '../../utils/math';

export const POPUP_WIDTH = 260;
export const INDEX_POPUP_WIDTH = 380;
const POPUP_MARGIN = 8;

/** The width is returned too: a fixed 380 cannot fit a 375px viewport, and clamping left alone only moves the overflow. */
export function popupPosition(
  rect: DOMRect,
  maxWidth: number
): { left: number; top?: number; bottom?: number; width: number } {
  const width = Math.min(maxWidth, window.innerWidth - 2 * POPUP_MARGIN);
  const center = rect.left + rect.width / 2;
  const left = clamp(center - width / 2, POPUP_MARGIN, window.innerWidth - width - POPUP_MARGIN);
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow < 200 && spaceAbove > spaceBelow) {
    return { left, width, bottom: window.innerHeight - rect.top + 8 };
  }
  return { left, width, top: rect.bottom + 8 };
}
