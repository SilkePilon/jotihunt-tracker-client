import { Position } from '@/types/Position';
import { useAuthSWR } from '../lib/swr';
import { Device } from '@/types/Device';
import { asList } from '@/lib/response-shape';

/** Traccar devices report every few seconds; polling faster only re-renders the map for nothing. */
const TRACKER_REFRESH_MS = 3000;

export const useDevices = () => {
  const { data: positions, error: positionsError, mutate: mutatePositions } = useAuthSWR<Position[]>('/tracker/positions', {
    refreshInterval: TRACKER_REFRESH_MS,
    dedupingInterval: TRACKER_REFRESH_MS,
  });
  const { data: devices, error: devicesError, mutate: mutateDevices } = useAuthSWR<Device[]>('/tracker/devices', {
    refreshInterval: TRACKER_REFRESH_MS,
    dedupingInterval: TRACKER_REFRESH_MS,
  });

  return {
    positions: asList(positions),
    devices: asList(devices),
    isLoading: !(positionsError || devicesError) && !(positions && devices),
    isError: positionsError || devicesError,
    retry: () => Promise.all([mutatePositions(), mutateDevices()]),
  };
};
