import { useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { BUILDINGS_ADMIN_URL, buildingsRefreshInterval, type BuildingsStatus } from '@/lib/buildings';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';

/** Admins: the 3D building cache (1 s while a job runs, 30 s otherwise) and its actions; each resolves to the new status. */
export function useBuildingsAdmin() {
  const authHeader = useAuthHeader() || '';
  // The interval follows the latest status as a plain number, adjusted during render (as in useLife360Admin)
  const [refreshInterval, setRefreshInterval] = useState(buildingsRefreshInterval());
  const { data, error, mutate } = useAuthSWR<BuildingsStatus>(BUILDINGS_ADMIN_URL, { refreshInterval });
  const nextInterval = buildingsRefreshInterval(data);
  if (nextInterval !== refreshInterval) setRefreshInterval(nextInterval);

  async function call(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<BuildingsStatus> {
    try {
      const status = (await fetcherWithMethod(`${BUILDINGS_ADMIN_URL}${path}`, authHeader, method, body, SLOW_REQUEST_TIMEOUT_MS)) as BuildingsStatus;
      await mutate(status, { revalidate: false });
      return status;
    } catch (caught) {
      // E.g. 409 (a job is running): show what the server has now
      void mutate();
      throw caught;
    }
  }

  return {
    status: data,
    isError: !!error,
    refresh: () => call('POST', '/refresh'),
    prefetch: (lat: number, lon: number, radiusKm: number) => call('POST', '/prefetch', { lat, lon, radiusKm }),
    clear: () => call('DELETE', ''),
  };
}
