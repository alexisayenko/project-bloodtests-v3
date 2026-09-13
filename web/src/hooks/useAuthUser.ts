import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../firebase/auth';

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
