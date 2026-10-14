import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { useAuth } from '@/hooks/auth.hook';
import type { AccountOverview } from '@/lib/account';
import type { User } from '@/types/User';

/** The Account dialog's data and actions; only fetches while `enabled` (the dialog is open). Actions throw the axios error. */
export function useAccount(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  const { updateUserState } = useAuth();
  const { data, error, mutate } = useAuthSWR<AccountOverview>(enabled ? '/account' : null, {
    refreshInterval: 30_000,
    // Closing nulls the key; keep the last data so the dialog doesn't flash skeletons while it animates out
    keepPreviousData: true,
  });
  const call = (path: string, method: 'PATCH' | 'DELETE', body?: unknown) => fetcherWithMethod(path, authHeader, method, body);
  const passkeyPath = (id: string) => `/account/passkeys/${encodeURIComponent(id)}`;

  return {
    account: data,
    error,
    refresh: () => mutate(),
    async renamePasskey(id: string, name: string) {
      await call(passkeyPath(id), 'PATCH', { name });
      await mutate();
    },
    async removePasskey(id: string) {
      const { user } = (await call(passkeyPath(id), 'DELETE')) as { user: User };
      await updateUserState(user);
      await mutate();
    },
    async removeSession(id: string) {
      await call(`/account/sessions/${encodeURIComponent(id)}`, 'DELETE');
      await mutate();
    },
    async removeOtherSessions() {
      const { removed } = (await call('/account/sessions', 'DELETE')) as { removed: number };
      await mutate();
      return removed;
    },
    async removeDevice(id: string) {
      await call(`/auth/devices/${encodeURIComponent(id)}`, 'DELETE');
      await mutate();
    },
  };
}
