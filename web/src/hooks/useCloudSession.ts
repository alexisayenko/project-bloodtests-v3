import { useCallback, useEffect, useState } from 'react';
import { fetchSession, signOutUser, type CloudProvider, type CloudSession, type CloudUser } from '../cloud/session';

const ALL_PROVIDERS: CloudProvider[] = ['google', 'apple'];

export function useCloudSession(): {
  user: CloudUser | null;
  loading: boolean;
  available: boolean;
  notAllowed: boolean;
  providers: CloudProvider[];
  signOut: () => Promise<void>;
} {
  const [session, setSession] = useState<CloudSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSession().then((next) => {
      if (!cancelled) setSession(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    const next = await fetchSession();
    setSession(next.status === 'signedOut' ? next : { status: 'signedOut', providers: [] });
  }, []);

  return {
    user: session?.status === 'signedIn' ? session.user : null,
    loading: session === null,
    available: session?.status !== 'unavailable',
    notAllowed: session?.status === 'notAllowed',
    providers: session?.status === 'signedOut' ? session.providers : session?.status === 'notAllowed' ? ALL_PROVIDERS : [],
    signOut,
  };
}
