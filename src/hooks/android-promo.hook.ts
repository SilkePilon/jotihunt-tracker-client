// src/hooks/android-promo.hook.ts
import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/media.hook';
import { useAppRelease } from '@/hooks/app-pairing.hook';
import { useAccount } from '@/hooks/account.hook';
import useTourStore from '@/components/tour/tour.store';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import useAccountDialogStore from '@/stores/account-dialog.store';
import useAndroidPromoStore from '@/stores/android-promo.store';
import { isAndroidUserAgent, readPromoState, shouldShowAndroidPromo } from '@/lib/android-promo';

const APP_ID = 'nl.jotihunt.tracker';
const OPEN_DELAY_MS = 1500;

type RelatedApp = { id?: string };
type NavigatorWithRelated = Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };

/** Opens the Android-app popup once per session when every condition in the spec holds. */
export function useAndroidPromoAutoOpen() {
  const isMobile = useIsMobile();
  const isAndroid = isAndroidUserAgent(navigator.userAgent);
  const relevant = isMobile && isAndroid;
  const { release } = useAppRelease();
  const { account: overview } = useAccount(relevant);
  const [installed, setInstalled] = useState<boolean | undefined>(undefined);
  const tourActive = useTourStore((s) => s.active);
  const meldingenOpen = useNotificationsDialogStore((s) => s.open);
  const accountOpen = useAccountDialogStore((s) => s.open);
  const opened = useRef(false);

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

  useEffect(() => {
    if (opened.current || !ready || busy) return;
    const show = shouldShowAndroidPromo({
      isMobile,
      isAndroid,
      hasRelease: !!release,
      paired: (overview?.devices.length ?? 0) > 0,
      installed: !!installed,
      state: readPromoState(localStorage),
      now: Date.now(),
    });
    if (!show) return;
    const id = window.setTimeout(() => {
      opened.current = true;
      useAndroidPromoStore.getState().show();
    }, OPEN_DELAY_MS);
    return () => clearTimeout(id);
  }, [ready, busy, isMobile, isAndroid, release, overview, installed]);
}
