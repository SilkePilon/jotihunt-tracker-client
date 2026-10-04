import { useEffect, useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod } from '@/lib/swr';
import type { PresenceEntry } from '@/types/Intel';

const HEARTBEAT_MS = 10_000;

/**
 * Tells the server which item (and hint area) this user has open, every 10 s while the tab is visible, and returns who
 * else is on the page. Failures are silent: presence never blocks the page.
 */
export function usePresence(itemId?: number, area?: string): PresenceEntry[] {
  const authHeader = useAuthHeader() || '';
  const [entries, setEntries] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    if (itemId === undefined) return;
    let stopped = false;

    async function beat() {
      if (document.visibilityState !== 'visible') return;
      try {
        const list = (await fetcherWithMethod('/presence', authHeader, 'POST', { itemId, ...(area ? { area } : {}) })) as PresenceEntry[];
        if (!stopped && Array.isArray(list)) setEntries(list);
      } catch {
        // Next beat tries again
      }
    }

    void beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [authHeader, itemId, area]);

  // Leaving the page (not switching items): tell the server at once instead of waiting for the entry to expire
  useEffect(() => {
    return () => {
      void fetcherWithMethod('/presence', authHeader, 'DELETE').catch(() => undefined);
    };
  }, [authHeader]);

  return entries;
}
