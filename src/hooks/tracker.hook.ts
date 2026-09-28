import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { trackerRefreshInterval } from '@/lib/tracker';
import type { TrackerMe, Vehicle } from '@/types/Tracker';

/** The logged-in user's own tracker: QR / deep link, vehicle, connected flag and stats. */
export const useTrackerStatus = () => {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<TrackerMe>('/tracker/me', { refreshInterval: trackerRefreshInterval });

  /** Save the vehicle; the server answers with the new status, which goes straight into the cache. Throws on failure. */
  async function setVehicle(vehicle: Vehicle): Promise<TrackerMe> {
    const status = (await fetcherWithMethod('/tracker/me/vehicle', authHeader, 'PUT', { vehicle })) as TrackerMe;
    await mutate(status, { revalidate: false });
    return status;
  }

  return { status: data, isError: !!error, setVehicle };
};
