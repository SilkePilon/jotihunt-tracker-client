import { HISTORY_WINDOW_MIN, type AreaHistory } from '@/lib/fox-history';
import { useAuthSWR } from '@/lib/swr';

const HISTORY_REFRESH_MS = 60_000;

/** One fox's last three hours (undefined until loaded); only fetched while its history panel is open (`area` set). */
export function useAreaHistory(area: string | null) {
  const { data, error, mutate } = useAuthSWR<AreaHistory>(area ? `/areas/${encodeURIComponent(area)}/history?minutes=${HISTORY_WINDOW_MIN}` : null, {
    refreshInterval: HISTORY_REFRESH_MS,
    revalidateOnFocus: true,
  });
  return { history: data, error: error as unknown, mutate };
}
