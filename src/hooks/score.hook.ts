import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useSWR from 'swr';
import { apiErrorStatus } from '@/lib/api-error';
import { reportFetchError, reportFetchSuccess } from '@/lib/connection';
import { normalizeScore, SCORE_NOT_CONFIGURED } from '@/lib/score';
import { fetcherWithMethod } from '@/lib/swr';
import type { ScoreStatus } from '@/types/Score';

/** The server reads the dashboard every 2 minutes; once a minute is plenty */
const SCORE_REFRESH_MS = 60_000;

/** GET /score, normalised; a 404 (a server without the score yet) is "not configured" instead of an error toast every minute. */
async function fetchScore([url, authHeader]: [string, string]): Promise<ScoreStatus> {
  try {
    const score = normalizeScore(await fetcherWithMethod(url, authHeader));
    reportFetchSuccess();
    return score;
  } catch (error) {
    if (apiErrorStatus(error) === 404) return SCORE_NOT_CONFIGURED;
    reportFetchError();
    throw error;
  }
}

/** Our provisional jotihunt.nl score (total + split), for the sidebar "Punten" card. */
export function useScore() {
  const authHeader = useAuthHeader();
  const { data, error } = useSWR<ScoreStatus>(['/score', authHeader], fetchScore, {
    refreshInterval: SCORE_REFRESH_MS,
    dedupingInterval: SCORE_REFRESH_MS,
    focusThrottleInterval: 30_000,
  });
  return { score: data, isError: !!error && !data };
}
