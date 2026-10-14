import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import type { User } from '@/types/User';

/** Errors carry who hit them: account id and name only (no e-mail, no IP). Cleared when Layout unmounts (shared HQ devices). */
export function useSentryUser() {
  const user = useAuthUser<User>();
  const id = user?._id;
  const name = user?.name;
  useEffect(() => {
    Sentry.setUser(id ? { id, username: name } : null);
    return () => Sentry.setUser(null);
  }, [id, name]);
}
