// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session, User } from '@supabase/supabase-js';
import { useSupabaseAuthUser } from '../src/hooks/useSupabaseAuthUser';

type AuthListener = (event: string, session: Session | null) => void;

const auth = {
  resolveSession: (() => {}) as (session: Session | null) => void,
  listener: null as AuthListener | null,
  unsubscribe: vi.fn(),
};

vi.mock('../src/supabase/auth', () => ({
  supabase: {
    auth: {
      getSession: () =>
        new Promise<{ data: { session: Session | null } }>((resolve) => {
          auth.resolveSession = (session) => resolve({ data: { session } });
        }),
      onAuthStateChange: (cb: AuthListener) => {
        auth.listener = cb;
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
      },
    },
  },
}));

const userOf = (id: string) => ({ id, email: `${id}@example.com` }) as User;
const sessionOf = (id: string) => ({ user: userOf(id) }) as Session;

let root: Root | null = null;
let container: HTMLDivElement;

function Harness() {
  const { user, loading } = useSupabaseAuthUser();
  return <div data-loading={String(loading)} data-user={user?.id ?? ''} />;
}

const state = () => {
  const el = container.querySelector('div')!;
  return { loading: el.dataset.loading, user: el.dataset.user };
};

async function mount(): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness />);
  });
}

const settle = (session: Session | null) => act(async () => auth.resolveSession(session));
const change = (event: string, session: Session | null) => act(async () => auth.listener!(event, session));

beforeEach(() => {
  auth.listener = null;
  auth.unsubscribe.mockClear();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

describe('useSupabaseAuthUser', () => {
  it('is loading with no user until the stored session is read', async () => {
    await mount();
    expect(state()).toEqual({ loading: 'true', user: '' });
  });

  it('settles signed out when there is no stored session', async () => {
    await mount();
    await settle(null);
    expect(state()).toEqual({ loading: 'false', user: '' });
  });

  it('settles on the stored session\'s user', async () => {
    await mount();
    await settle(sessionOf('u1'));
    expect(state()).toEqual({ loading: 'false', user: 'u1' });
  });

  it('follows sign-in and sign-out events after the initial read', async () => {
    await mount();
    await settle(null);
    await change('SIGNED_IN', sessionOf('u2'));
    expect(state()).toEqual({ loading: 'false', user: 'u2' });
    await change('SIGNED_OUT', null);
    expect(state()).toEqual({ loading: 'false', user: '' });
  });

  it('lets an auth event end the loading state before the session read returns', async () => {
    await mount();
    await change('SIGNED_IN', sessionOf('u3'));
    expect(state()).toEqual({ loading: 'false', user: 'u3' });
  });

  it('unsubscribes on unmount and ignores a session that arrives afterwards', async () => {
    await mount();
    await act(async () => {
      root!.unmount();
    });
    root = null;
    expect(auth.unsubscribe).toHaveBeenCalledTimes(1);
    await expect(settle(sessionOf('late'))).resolves.toBeUndefined();
  });
});
