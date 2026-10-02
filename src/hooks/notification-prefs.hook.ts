import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { NotificationPrefs } from '@/lib/notifications';

/** The user's opt-out notification settings (shared with the server for push). */
export const useNotificationPrefs = () => {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<NotificationPrefs>('/notifications/preferences', { refreshInterval: 60_000 });

  /** Throws the axios error on failure. */
  async function update(prefs: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const result = (await fetcherWithMethod('/notifications/preferences', authHeader, 'PUT', prefs)) as NotificationPrefs;
    await mutate(result, { revalidate: false });
    return result;
  }

  return { prefs: data, disabledTypes: data?.disabledTypes ?? [], update };
};
