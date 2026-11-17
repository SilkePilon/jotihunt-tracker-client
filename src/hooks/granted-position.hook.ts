import { useEffect, useState } from 'react';
import { geolocationGranted } from '@/lib/locate';
import type { LatLng } from '@/lib/own-position';

/**
 * The browser's position while `enabled`, only when location access was already granted: never prompts. Undefined
 * before the first fix, without access, or after a failed one.
 */
export function useGrantedBrowserPosition(enabled = true, options: PositionOptions = DEFAULT_OPTIONS): LatLng | undefined {
  const [position, setPosition] = useState<LatLng>();
  const { enableHighAccuracy, maximumAge } = options;

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    let cancelled = false;
    let watchId: number | undefined;
    void geolocationGranted().then((granted) => {
      if (cancelled || !granted) return;
      watchId = navigator.geolocation.watchPosition(
        (fix) => setPosition({ lat: fix.coords.latitude, lng: fix.coords.longitude }),
        () => setPosition(undefined),
        { enableHighAccuracy, maximumAge },
      );
    });
    return () => {
      cancelled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, enableHighAccuracy, maximumAge]);

  // Switched off: no stale position from an earlier watch
  return enabled ? position : undefined;
}

const DEFAULT_OPTIONS: PositionOptions = { maximumAge: 60_000 };
