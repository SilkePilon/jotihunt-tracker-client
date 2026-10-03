import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import MapPopup from '../../map/MapPopup';
import GoogleMapsButton from '../../map/GoogleMapsButton';
import MarkerRegistration from '../../map/MarkerRegistration';
import { formatBattery, formatSpeed } from '@/lib/tracker';
import { knotsToKmh } from '@/lib/utils';
import type { Position } from '@/types/Position';

const POPUP_OFFSET = { bottom: [0, -20] as [number, number] };

interface DevicePopupProps {
  /** The device's position from the current SWR data */
  position: Position;
  onClose: () => void;
}

/** Speed, battery and last fix of a tracker, plus Google Maps and "register marker here". */
export default function DevicePopup({ position, onClose }: DevicePopupProps) {
  return (
    <MapPopup longitude={position.longitude} latitude={position.latitude} onClose={onClose} offset={POPUP_OFFSET}>
      <div className="mr-6 flex flex-col gap-2 w-full">
        <div>
          <h2 className="font-semibold">{position.deviceName}</h2>
          <p>Snelheid: {formatSpeed(knotsToKmh(position.speed))}</p>
          <p>Batterij: {formatBattery(position.attributes.batteryLevel)}</p>
          <p>Laatste update: {formatDistanceToNow(position.fixTime, { locale: nl, addSuffix: true })}</p>
        </div>
        <GoogleMapsButton lat={position.latitude} lng={position.longitude} />
        <MarkerRegistration lat={position.latitude} lng={position.longitude} />
      </div>
    </MapPopup>
  );
}
