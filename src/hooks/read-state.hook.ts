import { useCallback, useRef } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { ReadState } from '@/types/Intel';

const READ_STATE_REFRESH_MS = 15_000;

/** Which articles the current user opened, and per article the names of everyone who opened it */
export const useReadState = () => {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<ReadState>('/articles/read', { refreshInterval: READ_STATE_REFRESH_MS });

  /** Ids whose POST is under way: a second call before the optimistic data is rendered must not send another one */
  const inFlight = useRef(new Set<number>());

  /** Mark an article as read: shown at once, stored in the background (a failure only means it shows unread again later) */
  const markRead = useCallback(
    async (articleId: number) => {
      if (data?.read.includes(articleId) || inFlight.current.has(articleId)) return;
      inFlight.current.add(articleId);
      await mutate(
        async (current) => {
          await fetcherWithMethod(`/articles/${articleId}/read`, authHeader, 'POST');
          return current;
        },
        {
          optimisticData: (current) => ({ read: [...(current?.read ?? []), articleId], readBy: current?.readBy ?? {} }),
          populateCache: false,
          revalidate: true,
          rollbackOnError: true,
        },
      )
        .catch(() => undefined)
        .finally(() => inFlight.current.delete(articleId));
    },
    [authHeader, data, mutate],
  );

  return { readState: data, markRead };
};
