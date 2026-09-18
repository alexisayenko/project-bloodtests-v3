import { describe, it, expect, vi } from 'vitest';
import { pressable } from '../src/components/primitives/styles';

describe('pressable', () => {
  it('wires click and keyboard activation to the same handler', () => {
    const handler = vi.fn();
    const props = pressable(handler);
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);

    const el = {} as HTMLElement;
    props.onClick({ currentTarget: el });
    props.onKeyDown({ key: 'Enter', preventDefault: vi.fn(), currentTarget: el });
    props.onKeyDown({ key: ' ', preventDefault: vi.fn(), currentTarget: el });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('ignores other keys', () => {
    const handler = vi.fn();
    pressable(handler).onKeyDown({ key: 'Escape', preventDefault: vi.fn(), currentTarget: {} as HTMLElement });
    expect(handler).not.toHaveBeenCalled();
  });
});
