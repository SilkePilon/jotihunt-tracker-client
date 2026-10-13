import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { isUnauthorized } from '@/lib/session';
import { fetcherWithMethod } from '@/lib/swr';
import { isRecent, mergeFeed, pickSound, shouldAlert, toastKind, type AppNotification } from '@/lib/notifications';
import { playNotificationSound } from '@/lib/notification-sounds';
import { showHighlightToast } from '@/components/notifications/HighlightToast';
import { useNotificationPrefs } from '@/hooks/notification-prefs.hook';
import useSettingsStore from '@/stores/settings.store';
import { revalidateTelegramViews } from '@/hooks/telegram.hook';

const POLL_MS = 5000;
/** Re-ask this far back each poll: a notification can be stored just after a poll read the server time. */
const OVERLAP_MS = 20_000;
/** Older notifications were already pushed to the phone (e.g. a backgrounded tab resuming): mark them seen without alerting. */
const MAX_ALERT_AGE_MS = 60_000;

interface FeedOptions {
  /** false on the HQ screen: alert on every type */
  respectPreferences?: boolean;
  toasts?: boolean;
  /** Called once per poll with the notifications that were alerted (sound/toast), when there are any */
  onPoll?: (alerted: AppNotification[]) => void;
  /** The poll got a 401: the session expired */
  onUnauthorized?: () => void;
}

/**
 * Poll the server's notification feed and alert (sound + toast) for new ones. Starts at "now": notifications
 * from before the page loaded are never replayed.
 */
export function useNotificationFeed({ respectPreferences = true, toasts = true, onPoll, onUnauthorized }: FeedOptions = {}) {
  const authHeader = useAuthHeader() || '';
  const { disabledTypes } = useNotificationPrefs();
  const soundMuted = useSettingsStore((state) => state.soundMuted);

  // Read inside the interval, so changing a setting doesn't restart polling
  const latest = useRef({ disabledTypes, soundMuted, respectPreferences, toasts, onPoll, onUnauthorized });
  useEffect(() => {
    latest.current = { disabledTypes, soundMuted, respectPreferences, toasts, onPoll, onUnauthorized };
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
        // A proxy page or error object with status 200: retry next poll without moving the cursor
        if (!Array.isArray(response?.notifications) || typeof response.serverTime !== 'string') return;
        if (!cursor) {
          startedAt = response.serverTime;
        }
        let fresh = cursor ? mergeFeed(seen, response.notifications) : [];
        if (startedAt) {
          fresh = fresh.filter((n) => new Date(n.createdAt).getTime() > new Date(startedAt!).getTime());
        }
        cursor = response.serverTime;
        // A tegenhunt came in: show it in the Tegenhunt card and on the map now, not at the next poll of /counter-hunt
        if (fresh.some((n) => n.type === 'counter-hunt')) revalidateTelegramViews();
        const options = latest.current;
        const alertable = fresh.filter((n) => isRecent(n, response.serverTime, MAX_ALERT_AGE_MS) && (!options.respectPreferences || shouldAlert(n.type, options.disabledTypes)));
        if (alertable.length === 0) return;
        // One sound per poll, for the most important notification: several at once would play on top of each other
        const sound = pickSound(alertable);
        if (sound && !options.soundMuted) playNotificationSound(sound);
        if (options.toasts) {
          for (const notification of alertable) {
            const duration = notification.urgent ? 30_000 : 8000;
            if (showHighlightToast(notification, duration)) continue;
            toast[toastKind(notification)](notification.title, { description: notification.body || undefined, duration });
          }
        }
        options.onPoll?.(alertable);
      } catch (error) {
        if (isUnauthorized(error)) latest.current.onUnauthorized?.();
        // Otherwise the next poll retries; the cursor only advances on success
      } finally {
        busy = false;
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(interval);
  }, [authHeader]);
}
