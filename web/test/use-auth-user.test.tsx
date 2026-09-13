// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useAuthUser } from '../src/hooks/useAuthUser';

type Callback = (user: unknown) => void;

let registered: Callback | null = null;
const unsubscribe = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: Callback) => {
    registered = callback;
    return unsubscribe;
  },
}));

vi.mock('../src/firebase/auth', () => ({ auth: {} }));

type Hook = ReturnType<typeof useAuthUser>;

async function mount(): Promise<{ latest: () => Hook; root: Root; unmount: () => void }> {
  let latest: Hook | undefined;
  function Probe() {
    const value = useAuthUser();
    useEffect(() => {
      latest = value;
    });
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<Probe />);
  });
  return { latest: () => latest!, root, unmount: () => root.unmount() };
}

describe('useAuthUser', () => {
  it('starts loading with no user, then reflects a signed-in user', async () => {
    const { latest, unmount } = await mount();
    expect(latest()).toEqual({ user: null, loading: true });

    const fakeUser = { uid: '123', displayName: 'Alex' };
    await act(async () => {
      registered?.(fakeUser);
    });
    expect(latest()).toEqual({ user: fakeUser, loading: false });

    unmount();
  });

  it('reflects sign-out as a null user', async () => {
    const { latest, unmount } = await mount();
    await act(async () => {
      registered?.({ uid: '123' });
    });
    await act(async () => {
      registered?.(null);
    });
    expect(latest()).toEqual({ user: null, loading: false });

    unmount();
  });

  it('unsubscribes on unmount', async () => {
    unsubscribe.mockClear();
    const { unmount } = await mount();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
