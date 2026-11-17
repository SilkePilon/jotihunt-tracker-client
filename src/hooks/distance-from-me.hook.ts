import { useDevices } from '@/hooks/devices.hook';
import { useNow } from '@/hooks/now.hook';
import { useGrantedBrowserPosition } from '@/hooks/granted-position.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { formatDistanceFromMe } from '@/lib/format';
import { OWN_POSITION_FRESH_MS, distanceMetres, ownDeviceId, ownTrackerPosition } from '@/lib/own-position';

/** "2,4 km van jou" from the own tracker (fix under a minute old) or an already-granted browser position; undefined otherwise. */
export function useDistanceFromMe(lat: number, lng: number): string | undefined {
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const now = useNow(false);
  const browser = useGrantedBrowserPosition();
  const own = ownTrackerPosition(positions, ownDeviceId(devices, status?.configured ? status.uniqueId : undefined), now, OWN_POSITION_FRESH_MS) ?? browser;
  return formatDistanceFromMe(own ? distanceMetres(own, { lat, lng }) : undefined);
}
