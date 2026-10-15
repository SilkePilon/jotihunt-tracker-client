import { useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { mutate as mutateGlobal } from 'swr';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import { JOTIBOARD_ADMIN_URL, jotiboardRefreshInterval } from '@/lib/jotiboard';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { swrKeyFor } from '@/lib/telegram';
import type { JotiboardCounts, JotiboardStatus } from '@/types/Jotiboard';

/** Imports change markers and hint cells: refetch those views. */
function revalidateImportedViews() {
  void mutateGlobal(swrKeyFor(['/markers', '/hints/board']));
}

/**
 * Admins: the Jotiboard sync status (3 s until the first sync landed, else 20 s) and its actions. Each action resolves to
 * the new status or throws the axios error (show it with apiErrorMessage).
 */
export function useJotiboardAdmin(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  const [refreshInterval, setRefreshInterval] = useState(jotiboardRefreshInterval(undefined));
  const { data, error, mutate } = useAuthSWR<JotiboardStatus>(enabled ? JOTIBOARD_ADMIN_URL : null, { refreshInterval });
  const nextInterval = jotiboardRefreshInterval(data);
  if (nextInterval !== refreshInterval) setRefreshInterval(nextInterval);

  async function send(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<JotiboardStatus> {
    try {
      const status = (await fetcherWithMethod(`${JOTIBOARD_ADMIN_URL}${path}`, authHeader, method, body, SLOW_REQUEST_TIMEOUT_MS)) as JotiboardStatus;
      await mutate(status, { revalidate: false });
      return status;
    } catch (error) {
      void mutate();
      throw error;
    }
  }

  /** Log in (also "Opnieuw inloggen"). 400 "Ongeldige gebruikersnaam of wachtwoord". */
  const link = (username: string, password: string) => send('/link', 'POST', { username, password });
  const unlink = () => send('/link', 'DELETE');
  const setSyncEnabled = (syncEnabled: boolean) => send('', 'PATCH', { syncEnabled });

  /** "Data verwijderen": resolves to what was removed. */
  async function purge(): Promise<JotiboardCounts> {
    try {
      const result = (await fetcherWithMethod(`${JOTIBOARD_ADMIN_URL}/imports`, authHeader, 'DELETE', undefined, SLOW_REQUEST_TIMEOUT_MS)) as {
        removed: { markers: number; hints: number };
        status: JotiboardStatus;
      };
      await mutate(result.status, { revalidate: false });
      revalidateImportedViews();
      return { pins: result.removed.markers, hints: result.removed.hints };
    } catch (error) {
      void mutate();
      throw error;
    }
  }

  return { status: enabled ? data : undefined, isError: !!error, link, unlink, setSyncEnabled, purge };
}
