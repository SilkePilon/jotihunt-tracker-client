import { Team } from '@/types/Team';
import { useAuthSWR } from '../lib/swr';
import { useFetcher } from './utils/api.hook';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import { asList } from '@/lib/response-shape';
import { appConfig } from '@/lib/app-config';
import { useAppConfig } from './app-config.hook';

const TEAMS_AREA_EDITING = import.meta.env.TEAMS_AREA_EDITING === 'true';

/** Our own group (Beheer → Algemeen → Ons team). */
export function isHomeTeam(team: Team): boolean {
  return isTeamWithApiId(team, appConfig().homeTeamApiId);
}

/** isHomeTeam with the home team id passed in (for memos that depend on it) */
export function isTeamWithApiId(team: Team, homeTeamApiId: number | null): boolean {
  return homeTeamApiId !== null && team.apiId === homeTeamApiId;
}

/** Our own group from the team list, or undefined while loading / when not configured. */
export function useHomeTeam(): Team | undefined {
  const { teams } = useTeams();
  useAppConfig(); // re-render when the home team is configured
  return teams?.find(isHomeTeam);
}

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

  /** @returns null when the teams were reloaded, else the error (never throws; show it with apiErrorMessage) */
  async function reloadTeams(): Promise<unknown> {
    try {
      const result = await fetch('/teams/reload', 'POST', undefined, SLOW_REQUEST_TIMEOUT_MS);
      return result.status === 200 ? null : new Error(`Unexpected status ${result.status}`);
    } catch (error) {
      return error ?? new Error('Request failed');
    } finally {
      await mutate();
    }
  }

  return {
    teams: asList(data),
    isLoading: !error && !data,
    isError: error,
    setTeamArea,
    reloadTeams,
  };
};
