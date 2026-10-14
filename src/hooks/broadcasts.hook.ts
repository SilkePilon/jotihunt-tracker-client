import { useAuthSWR } from '@/lib/swr';
import { asList } from '@/lib/response-shape';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import type { Broadcast } from '@/lib/beheer';
import { useFetcher } from './utils/api.hook';

const REFRESH_MS = 30_000;

/** Beheer → Bericht: messages sent to everyone (newest first). Pass `enabled` false to skip fetching. */
export const useBroadcasts = (enabled: boolean) => {
  const { data, error, mutate } = useAuthSWR<Broadcast[]>(enabled ? '/admin/broadcasts' : null, { refreshInterval: REFRESH_MS });
  const { fetch } = useFetcher();

  /** Push + sound to everyone (1–200 characters). Throws the axios error on failure. */
  async function send(message: string): Promise<void> {
    await fetch('/admin/broadcast', 'POST', { message }, SLOW_REQUEST_TIMEOUT_MS);
    void mutate();
  }

  return { broadcasts: asList(data), error, send };
};
