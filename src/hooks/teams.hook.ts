import { Team } from '@/types/Team';
import { useAuthSWR } from '../lib/swr';
import { useFetcher } from './utils/api.hook';

const TEAMS_AREA_EDITING = import.meta.env.TEAMS_AREA_EDITING === 'true';

export const useTeams = () => {
  // Teams only change on a reload or an area edit (both revalidate), so poll slowly
  const { data, error, mutate } = useAuthSWR<Team[]>('/teams', {
    refreshInterval: 30_000,
  });
  const { fetch } = useFetcher();

  /** @returns true when the server stored the area; never throws */
  async function setTeamArea(id: string, area: string | undefined): Promise<boolean> {
    if (!TEAMS_AREA_EDITING) return false;
    try {
      const result = await fetch(`/teams/${id}/area`, 'PUT', { area });
      return result.status === 200;
    } catch {
      return false;
    } finally {
      await mutate();
    }
  }

  async function reloadTeams(): Promise<boolean> {
    try {
      const result = await fetch('/teams/reload', 'POST');
      return result.status === 200;
    } catch {
      return false;
    } finally {
      await mutate();
    }
  }

  return {
    teams: data,
    isLoading: !error && !data,
    isError: error,
    setTeamArea,
    reloadTeams,
  };
};
