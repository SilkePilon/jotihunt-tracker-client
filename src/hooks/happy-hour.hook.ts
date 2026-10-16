import { useAuthSWR } from '@/lib/swr';
import { happyHourRefreshInterval } from '@/lib/happy-hour';
import type { HappyHourView } from '@/types/Telegram';

/** The current or next happy hour (hunts count double): polled every 30 s, 10 s around its start and end. */
export function useHappyHour() {
  const { data } = useAuthSWR<HappyHourView>('/happy-hour', { refreshInterval: happyHourRefreshInterval });
  return { view: data };
}
