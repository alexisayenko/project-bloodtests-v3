import { useCallback, useEffect, useState } from 'react';
import { fetchSession, signOutUser, type CloudSession, type CloudUser } from '../cloud/session';

export function useCloudSession(): {
  user: CloudUser | null;
  loading: boolean;
  available: boolean;
  notAllowed: boolean;
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
    setSession({ status: 'signedOut' });
  }, []);

  return {
    user: session?.status === 'signedIn' ? session.user : null,
    loading: session === null,
    available: session?.status !== 'unavailable',
    notAllowed: session?.status === 'notAllowed',
    signOut,
  };
}
