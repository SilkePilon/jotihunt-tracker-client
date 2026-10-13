import { useAuthSWR } from '@/lib/swr';
import { counterHuntRefreshInterval } from '@/lib/counter-hunt';
import type { CounterHuntView } from '@/types/Telegram';

/** The latest tegenhunt from the server (started by a @Jotihunt_bot message): polled every 30 s, 10 s while active. */
export function useCounterHunt() {
  const { data, error } = useAuthSWR<CounterHuntView>('/counter-hunt', { refreshInterval: counterHuntRefreshInterval });
  return { view: data, isError: !!error };
}
