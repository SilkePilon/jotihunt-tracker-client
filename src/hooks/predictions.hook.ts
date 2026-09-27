import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { useSWRConfig } from 'swr';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { GroupVisit, Prediction, VisitChoice } from '@/types/Prediction';

const PREDICTION_REFRESH_MS = 15_000;
/** The server recomputes in the background after PUT /visits; fetch once more after this delay. */
const RECOMPUTE_SETTLE_MS = 2_000;

const isPredictionsKey = (key: unknown) => Array.isArray(key) && key[0] === '/predictions';

export const usePredictions = () => {
  const { data, error } = useAuthSWR<Prediction[]>('/predictions', { refreshInterval: PREDICTION_REFRESH_MS });
  return { predictions: data, isLoading: !error && !data, isError: error };
};

export const useVisits = () => {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<GroupVisit[]>('/visits', { refreshInterval: PREDICTION_REFRESH_MS });
  const { mutate: mutateGlobal } = useSWRConfig();

  /**
   * Set a manual visit state ('visited' / 'not_visited') or go back to automatic ('auto').
   * Puts the server's answer straight into the cache and revalidates the predictions right away (and once
   * more when the background recompute has settled); throws the axios error on failure.
   */
  async function setVisit(teamApiId: number, state: VisitChoice): Promise<GroupVisit> {
    const visit = (await fetcherWithMethod(`/visits/${teamApiId}`, authHeader, 'PUT', { state })) as GroupVisit;
    await mutate((current) => [...(current ?? []).filter((existing) => existing.teamApiId !== teamApiId), visit], { revalidate: false });
    void mutateGlobal(isPredictionsKey);
    setTimeout(() => void mutateGlobal(isPredictionsKey), RECOMPUTE_SETTLE_MS);
    return visit;
  }

  return { visits: data, isLoading: !error && !data, isError: error, setVisit };
};
