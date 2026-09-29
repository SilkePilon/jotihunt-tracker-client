import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { useSWRConfig } from 'swr';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { GroupVisit, Prediction, VisitChoice } from '@/types/Prediction';

const PREDICTION_REFRESH_MS = 15_000;
/** The server recomputes in the background after PUT /visits (a Gemini call takes tens of seconds); fetch once more after this delay. */
const RECOMPUTE_SETTLE_MS = 45_000;

const SETTING_REFRESH_MS = 30_000;
const isPredictionsKey = (key: unknown) => Array.isArray(key) && key[0] === '/predictions';

const isPredictionRelatedKey = (key: unknown) => Array.isArray(key) && (key[0] === '/predictions' || key[0] === '/visits');

/**
 * Global admin switch for the AI fox prediction. `enabled` is undefined until loaded; hide prediction UI only when
 * it is exactly `false`.
 */
export const usePredictionSetting = () => {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<{ enabled: boolean }>('/settings/prediction', { refreshInterval: SETTING_REFRESH_MS });
  const { mutate: mutateGlobal } = useSWRConfig();

  /** Admin only; throws the axios error on failure. */
  async function setEnabled(enabled: boolean) {
    const result = (await fetcherWithMethod('/settings/prediction', authHeader, 'PUT', { enabled })) as { enabled: boolean };
    await mutate(result, { revalidate: false });
    await mutateGlobal(isPredictionRelatedKey);
    return result.enabled;
  }

  return { enabled: data?.enabled, setEnabled };
};

export const usePredictions = () => {
  const { enabled } = usePredictionSetting();
  const { data, error } = useAuthSWR<Prediction[]>(enabled === false ? null : '/predictions', { refreshInterval: PREDICTION_REFRESH_MS });
  return { predictions: data, isLoading: !error && !data, isError: error };
};

export const useVisits = () => {
  const authHeader = useAuthHeader() || '';
  const { enabled } = usePredictionSetting();
  const { data, error, mutate } = useAuthSWR<GroupVisit[]>(enabled === false ? null : '/visits', { refreshInterval: PREDICTION_REFRESH_MS });
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
