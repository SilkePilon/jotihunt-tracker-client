import { useAuthSWR } from '@/lib/swr';
import type { Leaderboard } from '@/types/Leaderboard';

/** Fetches only while the leaderboard is open; refreshes every minute. */
export const useLeaderboard = (enabled: boolean) => {
  const { data, error } = useAuthSWR<Leaderboard>(enabled ? '/leaderboard' : null, { refreshInterval: 60_000 });
  return { board: data, isLoading: enabled && !error && !data, isError: !!error };
};
