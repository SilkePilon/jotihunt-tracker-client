import { useMemo } from 'react';
import { useAuthSWR, useAuthSWRInfinite } from '@/lib/swr';
import { flattenEventPages, huntEventsPath, normalizeSyncedHunt } from '@/lib/hunt-sync';
import { asList } from '@/lib/response-shape';
import type { HuntSyncEvent, HuntSyncStatus, SyncedHunt } from '@/types/HuntSync';

const SYNC_REFRESH_MS = 5_000;
const EVENTS_REFRESH_MS = 15_000;
const HUNTS_REFRESH_MS = 5_000;

/** The jotihunt.nl sync state (configured / running / last success / error, counts and points). */
export function useHuntSync() {
  const { data, error } = useAuthSWR<HuntSyncStatus>('/hunts/sync', { refreshInterval: SYNC_REFRESH_MS, dedupingInterval: SYNC_REFRESH_MS });
  return { status: data, isError: !!error && !data };
}

/** The sync log, newest first; `loadMore` fetches the next (older) page until `reachedEnd`. */
export function useHuntEvents(enabled = true) {
  const { data, error, size, setSize } = useAuthSWRInfinite<HuntSyncEvent[]>(enabled ? huntEventsPath : null, {
    refreshInterval: EVENTS_REFRESH_MS,
    dedupingInterval: EVENTS_REFRESH_MS,
  });
  const lastPage = data?.[data.length - 1];
  const reachedEnd = data !== undefined && (!Array.isArray(lastPage) || huntEventsPath(data.length, lastPage) === null);
  const loadingMore = size > 0 && data !== undefined && data.length < size;
  const events = useMemo(() => (data === undefined ? undefined : flattenEventPages(data)), [data]);
  return {
    events,
    isError: !!error && !data,
    reachedEnd,
    loadingMore,
    loadMore: () => {
      if (!reachedEnd && !loadingMore) void setSize(size + 1);
    },
  };
}

/** Every synced hunt (GET /hunts); one request per poll however many components use it. */
export function useSyncedHunts() {
  const { data, error } = useAuthSWR<SyncedHunt[]>('/hunts', { refreshInterval: HUNTS_REFRESH_MS, dedupingInterval: HUNTS_REFRESH_MS });
  const hunts = useMemo(() => asList(data)?.map(normalizeSyncedHunt), [data]);
  return { hunts, isLoading: !error && !data, isError: !!error };
}
