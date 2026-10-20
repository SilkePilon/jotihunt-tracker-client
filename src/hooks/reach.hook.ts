import { useAuthSWR } from '@/lib/swr';
import type { AreaReach, ReachResponse } from '@/lib/reach';

const REACH_REFRESH_MS = 60_000;

/** The foxes' reachable areas (undefined until loaded); only fetched while the layer is on. */
export function useReach(enabled: boolean): { areas: AreaReach[] | undefined } {
  const { data } = useAuthSWR<ReachResponse>(enabled ? '/routes/reach' : null, { refreshInterval: REACH_REFRESH_MS });
  return { areas: data?.areas };
}
