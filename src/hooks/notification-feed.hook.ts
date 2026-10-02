import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod } from '@/lib/swr';
import { mergeFeed, shouldAlert, soundKey, toastKind, type AppNotification } from '@/lib/notifications';
import { playNotificationSound } from '@/lib/notification-sounds';
import { useNotificationPrefs } from '@/hooks/notification-prefs.hook';
import useSettingsStore from '@/stores/settings.store';

const POLL_MS = 5000;
/** Re-ask this far back each poll: a notification can be stored just after a poll read the server time. */
const OVERLAP_MS = 20_000;

interface FeedOptions {
  /** false on the HQ screen: alert on every type */
  respectPreferences?: boolean;
  toasts?: boolean;
  onNotification?: (notification: AppNotification) => void;
}

/**
 * Poll the server's notification feed and alert (sound + toast) for new ones. Starts at "now": notifications
 * from before the page loaded are never replayed.
 */
export function useNotificationFeed({ respectPreferences = true, toasts = true, onNotification }: FeedOptions = {}) {
  const authHeader = useAuthHeader() || '';
  const { disabledTypes } = useNotificationPrefs();
  const soundMuted = useSettingsStore((state) => state.soundMuted);

  // Read inside the interval, so changing a setting doesn't restart polling
  const latest = useRef({ disabledTypes, soundMuted, respectPreferences, toasts, onNotification });
  useEffect(() => {
    latest.current = { disabledTypes, soundMuted, respectPreferences, toasts, onNotification };
  });

  useEffect(() => {
    if (!authHeader) return;
    let cursor: string | null = null;
    let busy = false;
    const seen = new Set<string>();
    let startedAt: string | null = null;

    async function poll() {
      if (busy) return;
      busy = true;
      try {
        const since = cursor ? `?since=${encodeURIComponent(new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString())}` : '';
        const response = (await fetcherWithMethod(`/notifications${since}`, authHeader)) as { notifications: AppNotification[]; serverTime: string };
        if (!cursor) {
          startedAt = response.serverTime;
        }
        let fresh = cursor ? mergeFeed(seen, response.notifications) : [];
        if (startedAt) {
          fresh = fresh.filter((n) => new Date(n.createdAt).getTime() > new Date(startedAt!).getTime());
        }
        cursor = response.serverTime;
        const options = latest.current;
        let played = false;
        for (const notification of fresh) {
          if (options.respectPreferences && !shouldAlert(notification.type, options.disabledTypes)) continue;
          // One sound per poll: several events at once would play on top of each other
          if (!options.soundMuted && !played) {
            playNotificationSound(soundKey(notification));
            played = true;
          }
          if (options.toasts) {
            toast[toastKind(notification)](notification.title, { description: notification.body || undefined, duration: notification.urgent ? 30_000 : 8000 });
          }
          options.onNotification?.(notification);
        }
      } catch {
        // Next poll retries; the cursor only advances on success
      } finally {
        busy = false;
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(interval);
  }, [authHeader]);
}
