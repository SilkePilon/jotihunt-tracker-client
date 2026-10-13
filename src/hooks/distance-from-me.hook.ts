import { useEffect, useState } from 'react';
import { useDevices } from '@/hooks/devices.hook';
import { useNow } from '@/hooks/now.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { formatDistanceFromMe } from '@/lib/format';
import { distanceMetres, ownDeviceId, ownTrackerPosition, type LatLng } from '@/lib/own-position';

/** The browser's position, only when location access was already granted: never prompts. */
function useGrantedBrowserPosition(): LatLng | undefined {
  const [position, setPosition] = useState<LatLng>();

  useEffect(() => {
    if (!('geolocation' in navigator) || !navigator.permissions) return;
    let cancelled = false;
    let watchId: number | undefined;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return;
        watchId = navigator.geolocation.watchPosition(
          (fix) => setPosition({ lat: fix.coords.latitude, lng: fix.coords.longitude }),
          () => setPosition(undefined),
          { maximumAge: 60_000 },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return position;
}

/** "2,4 km van jou" from the own tracker (fresh) or an already-granted browser position; undefined otherwise. */
export function useDistanceFromMe(lat: number, lng: number): string | undefined {
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const now = useNow(false);
  const browser = useGrantedBrowserPosition();
  const own = ownTrackerPosition(positions, ownDeviceId(devices, status?.configured ? status.uniqueId : undefined), now) ?? browser;
  return formatDistanceFromMe(own ? distanceMetres(own, { lat, lng }) : undefined);
}
