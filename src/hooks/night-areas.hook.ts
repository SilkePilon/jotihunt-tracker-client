import { useCallback } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { rebuildFailure, type RebuildResult } from '@/lib/trails';
import type { RouterStatus, RoutesSetting } from '@/types/Trail';

const URL = '/settings/night-areas';

export function useNightAreas() {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<RoutesSetting>(URL, { refreshInterval: 30_000 });
  const save = useCallback(
    async (next: RoutesSetting): Promise<RoutesSetting> => {
      const result = await mutate(async () => (await fetcherWithMethod(URL, authHeader, 'PUT', next)) as RoutesSetting, {
        optimisticData: next, rollbackOnError: true, populateCache: true, revalidate: false,
      });
      return result ?? next;
    },
    [authHeader, mutate],
  );
  return { setting: data, save };
}

export function useRouterStatus(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<RouterStatus>(enabled ? '/admin/router' : null, { refreshInterval: 10_000 });
  const rebuild = useCallback(async (): Promise<RebuildResult> => {
    try {
      await fetcherWithMethod('/admin/router/rebuild', authHeader, 'POST', {});
      await mutate();
      return 'started';
    } catch (error) {
      const result = rebuildFailure(error);
      if (result === 'busy') await mutate();
      return result;
    }
  }, [authHeader, mutate]);
  return { status: data, rebuild };
}
