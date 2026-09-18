import { describe, it, expect, vi } from 'vitest';
import { popupPosition } from '../src/components/conditions/popupGeometry';

describe('popupPosition', () => {
  const rect = (partial: Partial<DOMRect>): DOMRect => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...partial });

  it('anchors below the element when there is room', () => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
    const p = popupPosition(rect({ left: 400, width: 100, top: 100, bottom: 130 }), 260);
    expect(p.top).toBe(138);
    expect(p.bottom).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('flips above when the element is near the bottom', () => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
    const p = popupPosition(rect({ left: 400, width: 100, top: 700, bottom: 730 }), 260);
    expect(p.bottom).toBe(800 - 700 + 8);
    expect(p.top).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('clamps the left edge into the viewport', () => {
    vi.stubGlobal('window', { innerWidth: 300, innerHeight: 800 });
    const p = popupPosition(rect({ left: 0, width: 10, top: 10, bottom: 30 }), 260);
    expect(p.left).toBe(8);
    vi.unstubAllGlobals();
  });

  it('keeps the right edge in the viewport for an element near it', () => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
    const p = popupPosition(rect({ left: 960, width: 40, top: 100, bottom: 130 }), 260);
    expect(p.left).toBe(1000 - 260 - 8);
    vi.unstubAllGlobals();
  });

  it('narrows a popup wider than the viewport instead of overflowing it', () => {
    vi.stubGlobal('window', { innerWidth: 375, innerHeight: 812 });
    const p = popupPosition(rect({ left: 20, width: 100, top: 100, bottom: 130 }), 380);
    expect(p.width).toBe(375 - 16);
    expect(p.left).toBe(8);
    expect(p.left + p.width).toBe(375 - 8);
    vi.unstubAllGlobals();
  });

  it('leaves a popup that already fits at its full width', () => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
    const p = popupPosition(rect({ left: 400, width: 100, top: 100, bottom: 130 }), 380);
    expect(p.width).toBe(380);
    expect(p.left).toBe(450 - 190);
    vi.unstubAllGlobals();
  });

  it('never returns a negative left, whatever the anchor', () => {
    vi.stubGlobal('window', { innerWidth: 320, innerHeight: 800 });
    for (const left of [0, 150, 310]) {
      const p = popupPosition(rect({ left, width: 10, top: 100, bottom: 130 }), 380);
      expect(p.left).toBeGreaterThanOrEqual(8);
      expect(p.left + p.width).toBeLessThanOrEqual(320 - 8);
    }
    vi.unstubAllGlobals();
  });
});
