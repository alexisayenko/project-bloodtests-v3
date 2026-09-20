// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CloudSession } from '../src/cloud/session';
import { useCloudSession } from '../src/hooks/useCloudSession';

const session = {
  resolve: (() => {}) as (value: CloudSession) => void,
  signOutUser: vi.fn(),
};

vi.mock('../src/cloud/session', () => ({
  fetchSession: () =>
    new Promise<CloudSession>((resolve) => {
      session.resolve = resolve;
    }),
  signOutUser: (...args: unknown[]) => session.signOutUser(...args),
}));

const signedIn = (email: string): CloudSession => ({ status: 'signedIn', user: { email, provider: 'google' } });

let root: Root | null = null;
let container: HTMLDivElement;
const handle = { signOut: (): Promise<void> => Promise.resolve() };

function Harness() {
  const state = useCloudSession();
  useEffect(() => {
    handle.signOut = state.signOut;
  });
  return <div data-loading={String(state.loading)} data-user={state.user?.email ?? ''} data-available={String(state.available)} data-not-allowed={String(state.notAllowed)} data-providers={state.providers.join(',')} />;
}

const state = () => {
  const el = container.querySelector('div')!;
  return { loading: el.dataset.loading, user: el.dataset.user, available: el.dataset.available, notAllowed: el.dataset.notAllowed, providers: el.dataset.providers };
};

async function mount(): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness />);
  });
}

const settle = (value: CloudSession) => act(async () => session.resolve(value));

beforeEach(() => {
  session.signOutUser.mockReset();
  session.signOutUser.mockResolvedValue(undefined);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

describe('useCloudSession', () => {
  it('is loading with no user until /auth/me answers', async () => {
    await mount();
    expect(state()).toEqual({ loading: 'true', user: '', available: 'true', notAllowed: 'false', providers: '' });
  });

  it('settles signed out', async () => {
    await mount();
    await settle({ status: 'signedOut', providers: ['google'] });
    expect(state()).toEqual({ loading: 'false', user: '', available: 'true', notAllowed: 'false', providers: 'google' });
  });

  it('settles on the signed-in user', async () => {
    await mount();
    await settle(signedIn('u1@example.com'));
    expect(state()).toEqual({ loading: 'false', user: 'u1@example.com', available: 'true', notAllowed: 'false', providers: '' });
  });

  it('reports a not-allowed account, still offering sign-in', async () => {
    await mount();
    await settle({ status: 'notAllowed' });
    expect(state()).toEqual({ loading: 'false', user: '', available: 'true', notAllowed: 'true', providers: 'google,apple' });
  });

  it('reports sign-in unavailable when there is no Worker', async () => {
    await mount();
    await settle({ status: 'unavailable' });
    expect(state()).toEqual({ loading: 'false', user: '', available: 'false', notAllowed: 'false', providers: '' });
  });

  it('drops the user after signing out', async () => {
    await mount();
    await settle(signedIn('u2@example.com'));
    await act(async () => {
      const done = handle.signOut();
      await vi.waitFor(() => expect(session.signOutUser).toHaveBeenCalledTimes(1));
      await Promise.resolve();
      session.resolve({ status: 'signedOut', providers: ['google', 'apple'] });
      await done;
    });
    expect(state().user).toBe('');
    expect(state().providers).toBe('google,apple');
  });

  it('keeps the user when sign-out fails', async () => {
    await mount();
    await settle(signedIn('u3@example.com'));
    session.signOutUser.mockRejectedValue(new Error('403'));
    await act(async () => {
      await handle.signOut().catch(() => {});
    });
    expect(state().user).toBe('u3@example.com');
  });

  it('ignores an answer that arrives after unmount', async () => {
    await mount();
    await act(async () => {
      root!.unmount();
    });
    root = null;
    await expect(settle(signedIn('late@example.com'))).resolves.toBeUndefined();
  });
});
