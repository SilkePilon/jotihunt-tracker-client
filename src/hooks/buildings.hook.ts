import { BUILDINGS_ADMIN_URL, buildingsRefreshInterval, type BuildingsStatus } from '@/lib/buildings';
import { useAdaptiveSWR, useStatusAction } from '@/lib/swr';

/** Admins: the 3D building cache (1 s while a job runs, 30 s otherwise) and its actions; each resolves to the new status. */
export function useBuildingsAdmin() {
  // The interval follows the latest status
  const { data, error, mutate } = useAdaptiveSWR<BuildingsStatus>(BUILDINGS_ADMIN_URL, buildingsRefreshInterval, buildingsRefreshInterval());
  // Failing with e.g. 409 (a job is running) refetches the status
  const send = useStatusAction(mutate);
  const call = (method: 'POST' | 'DELETE', path: string, body?: unknown) => send(`${BUILDINGS_ADMIN_URL}${path}`, method, body);

  return {
    status: data,
    isError: !!error,
    refresh: () => call('POST', '/refresh'),
    prefetch: (lat: number, lon: number, radiusKm: number) => call('POST', '/prefetch', { lat, lon, radiusKm }),
    clear: () => call('DELETE', ''),
  };
}
