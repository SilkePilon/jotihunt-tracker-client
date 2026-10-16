import { useCallback } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { isForbiddenArea, type HuntableAreasSetting } from '@/lib/huntable-areas';
import { isHomeTeam, useTeams } from './teams.hook';
import { useAppConfig } from './app-config.hook';

/** Changes a few times per game at most; poll slowly like the prediction setting. */
const SETTING_REFRESH_MS = 30_000;
const URL = '/settings/huntable-areas';

/**
 * Which foxes we may hunt (rule 5.1). `allowed` is undefined while loading and null when an admin never set it (every
 * fox allowed). `isForbidden` also waits for the team list and /config, so our own fox never flashes a lock while /teams loads.
 */
export function useHuntableAreas() {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<HuntableAreasSetting>(URL, { refreshInterval: SETTING_REFRESH_MS });
  const { teams } = useTeams();
  // Re-render when the home team is configured (ownArea is a dep of isForbidden); wait for /config too, so a home team
  // that isn't known yet doesn't lock our own fox for a moment
  const { loaded } = useAppConfig();
  const ownArea = teams?.find(isHomeTeam)?.area;
  const allowed = data?.areas;
  const ready = teams !== undefined && loaded;

  const isForbidden = useCallback((area: string) => ready && isForbiddenArea(area, ownArea, allowed), [ready, ownArea, allowed]);

  /** Admin only. Shown at once; on failure the old list comes back and the axios error is thrown (callers toast). */
  const setAllowed = useCallback(
    async (areas: string[]): Promise<string[]> => {
      const result = await mutate(async () => (await fetcherWithMethod(URL, authHeader, 'PUT', { areas })) as HuntableAreasSetting, {
        optimisticData: { areas },
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      });
      return result?.areas ?? areas;
    },
    [authHeader, mutate],
  );

  return { allowed, setAllowed, isForbidden };
}
