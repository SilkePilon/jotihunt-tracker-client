import { useCallback } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { ReadState } from '@/types/Intel';

const READ_STATE_REFRESH_MS = 15_000;

/** Which articles the current user opened, and how many users opened each */
export const useReadState = () => {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<ReadState>('/articles/read', { refreshInterval: READ_STATE_REFRESH_MS });

  /** Mark an article as read: shown at once, stored in the background (a failure only means it shows unread again later) */
  const markRead = useCallback(
    async (articleId: number) => {
      if (data?.read.includes(articleId)) return;
      const key = String(articleId);
      await mutate(
        async (current) => {
          await fetcherWithMethod(`/articles/${articleId}/read`, authHeader, 'POST');
          return current;
        },
        {
          optimisticData: (current) => ({ read: [...(current?.read ?? []), articleId], readBy: { ...current?.readBy, [key]: (current?.readBy[key] ?? 0) + 1 } }),
          populateCache: false,
          revalidate: true,
          rollbackOnError: true,
        },
      ).catch(() => undefined);
    },
    [authHeader, data, mutate],
  );

  return { readState: data, markRead };
};
