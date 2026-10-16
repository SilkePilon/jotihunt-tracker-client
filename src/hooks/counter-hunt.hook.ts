import { useAuthSWR } from '@/lib/swr';
import { counterHuntRefreshInterval, counterHuntState } from '@/lib/counter-hunt';
import type { CounterHuntView } from '@/types/Telegram';
import { useNow } from './now.hook';
import { useAppConfig } from './app-config.hook';

/**
 * The latest tegenhunt from the server (started by a @Jotihunt_bot message): polled every 30 s, 10 s while active.
 * `state` applies the 30 minutes client-side (a clock ticks while the server reports one as active).
 */
export function useCounterHunt(enabled = true) {
  // Without our own group there is no clubhouse to hunt, no sector and no card: don't poll.
  const { homeTeamApiId } = useAppConfig();
  const { data, error } = useAuthSWR<CounterHuntView>(enabled && homeTeamApiId !== null ? '/counter-hunt' : null, { refreshInterval: counterHuntRefreshInterval });
  const now = useNow(!!data?.active);
  return { view: data, state: counterHuntState(data, now), now, isError: !!error };
}
