import { HISTORY_WINDOW_MIN, type AreaHistory } from '@/lib/fox-history';
import { useAuthSWR } from '@/lib/swr';

const HISTORY_REFRESH_MS = 60_000;

/** One fox's last three hours (undefined until loaded); only fetched while its history panel is open (`area` set). */
export function useAreaHistory(area: string | null) {
  const { data, error, mutate } = useAuthSWR<AreaHistory>(area ? `/areas/${encodeURIComponent(area)}/history?minutes=${HISTORY_WINDOW_MIN}` : null, {
    refreshInterval: HISTORY_REFRESH_MS,
    revalidateOnFocus: true,
    // The panel shows its own "Historie niet geladen" with a retry, so no app-wide error toast for this request (like
    // useAppRelease). A 401 still ends the session through the other polls.
    onError: () => {},
  });
  return { history: data, error: error as unknown, mutate };
}
