import { useCallback } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { TrailsResponse } from '@/types/Trail';

const URL = '/routes/trails';

export function useTrails() {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<TrailsResponse>(URL, { refreshInterval: 5000, dedupingInterval: 5000 });
  const setLegMode = useCallback(
    async (markerId: string, legMode: 'walk' | 'car' | null) => {
      await fetcherWithMethod(`/routes/legs/${markerId}`, authHeader, 'PATCH', { legMode });
      await mutate();
    },
    [authHeader, mutate],
  );
  return { data, setLegMode };
}
