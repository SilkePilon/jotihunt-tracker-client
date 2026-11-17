// src/hooks/android-promo.hook.ts
import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/media.hook';
import { useAppRelease } from '@/hooks/app-pairing.hook';
import { useAccount } from '@/hooks/account.hook';
import useTourStore from '@/components/tour/tour.store';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import useAccountDialogStore from '@/stores/account-dialog.store';
import useAndroidPromoStore from '@/stores/android-promo.store';
import usePromptQueueStore from '@/stores/prompt-queue.store';
import { isAndroidUserAgent, readPromoState, shouldShowAndroidPromo } from '@/lib/android-promo';

const APP_ID = 'nl.jotihunt.tracker';

type RelatedApp = { id?: string };
type NavigatorWithRelated = Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };

/** localStorage, or null when site data is blocked (merely touching window.localStorage throws a SecurityError then). */
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Opens the Android-app popup once per session when every condition in the spec holds, on its turn in the prompt queue
 * (one follow-up prompt at a time, after a short gap).
 */
export function useAndroidPromoAutoOpen() {
  const isMobile = useIsMobile();
  const isAndroid = isAndroidUserAgent(navigator.userAgent);
  const relevant = isMobile && isAndroid;
  const { release } = useAppRelease();
  // Shown this session: done, so stop polling /account
  const [shown, setShown] = useState(false);
  const { account: overview } = useAccount(relevant && !shown);
  const [installed, setInstalled] = useState<boolean | undefined>(undefined);
  const tourActive = useTourStore((s) => s.active);
  const meldingenOpen = useNotificationsDialogStore((s) => s.open);
  const accountOpen = useAccountDialogStore((s) => s.open);

  useEffect(() => {
    if (!relevant) return;
    const nav = navigator as NavigatorWithRelated;
    // No API (non-Chrome) = treat as not installed; resolved async so setState stays out of the effect body
    (nav.getInstalledRelatedApps?.() ?? Promise.resolve([]))
      .then((apps) => setInstalled(apps.some((app) => app.id === APP_ID)))
      .catch(() => setInstalled(false));
  }, [relevant]);

  const ready = release !== undefined && overview !== undefined && installed !== undefined;
  const busy = tourActive || meldingenOpen || accountOpen;

  // Wait in the prompt queue while the popup should show
  useEffect(() => {
    const queue = usePromptQueueStore.getState();
    const wanted = !shown && ready && !busy && eligible();
    if (wanted) queue.request('android-promo');
    else queue.cancel('android-promo');

    function eligible() {
      // Spec: only when storage allows (otherwise "later"/"never" can't be remembered)
      const storage = safeStorage();
      if (!storage) return false;
      return shouldShowAndroidPromo({
        isMobile,
        isAndroid,
        hasRelease: !!release,
        paired: (overview?.devices.length ?? 0) > 0,
        installed: !!installed,
        state: readPromoState(storage),
        now: Date.now(),
      });
    }
  }, [shown, ready, busy, isMobile, isAndroid, release, overview, installed]);

  // Its turn: show it; closing it lets the next prompt follow
  useEffect(() => {
    const offQueue = usePromptQueueStore.subscribe((state, prev) => {
      if (state.active === 'android-promo' && prev.active !== 'android-promo') {
        setShown(true);
        useAndroidPromoStore.getState().show();
      }
    });
    const offPopup = useAndroidPromoStore.subscribe((state, prev) => {
      if (prev.open && !state.open) usePromptQueueStore.getState().done('android-promo');
    });
    return () => {
      offQueue();
      offPopup();
      // Unmounted (logout, a 401): leave the queue, and if the popup is on screen as this prompt, close it and free the
      // turn, so nothing carries over into the next session or blocks the queue
      const queue = usePromptQueueStore.getState();
      if (queue.active === 'android-promo') useAndroidPromoStore.setState({ open: false });
      queue.release('android-promo');
    };
  }, []);
}
