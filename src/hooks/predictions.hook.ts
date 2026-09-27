import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { GroupVisit, Prediction, VisitChoice } from '@/types/Prediction';

const PREDICTION_REFRESH_MS = 15_000;

export const usePredictions = () => {
  const { data, error } = useAuthSWR<Prediction[]>('/predictions', { refreshInterval: PREDICTION_REFRESH_MS });
  return { predictions: data, isLoading: !error && !data, isError: error };
};

export const useVisits = () => {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<GroupVisit[]>('/visits', { refreshInterval: PREDICTION_REFRESH_MS });

  /**
   * Set a manual visit state ('visited' / 'not_visited') or go back to automatic ('auto').
   * Puts the server's answer straight into the cache; throws the axios error on failure.
   */
  async function setVisit(teamApiId: number, state: VisitChoice): Promise<GroupVisit> {
    const visit = (await fetcherWithMethod(`/visits/${teamApiId}`, authHeader, 'PUT', { state })) as GroupVisit;
    await mutate((current) => [...(current ?? []).filter((existing) => existing.teamApiId !== teamApiId), visit], { revalidate: false });
    return visit;
  }

  return { visits: data, isLoading: !error && !data, isError: error, setVisit };
};
