import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import GoogleMapsButton from '@/components/map/GoogleMapsButton';
import MapPopup from '@/components/map/MapPopup';
import { formatAccuracy, formatBattery, formatSpeed } from '@/lib/tracker';
import type { Life360Location, Life360Member } from '@/types/Life360';

// Above the 44 px cookie
const POPUP_OFFSET = { bottom: [0, -24] as [number, number] };

interface Life360PopupProps {
  member: Life360Member;
  location: Life360Location;
  /** The link is logged out or paused: this is the last known position */
  linkStale: boolean;
  onClose: () => void;
}

/** Like the hunter popup: name, age, driving speed, battery, accuracy, Navigeer. */
export default function Life360Popup({ member, location, linkStale, onClose }: Life360PopupProps) {
  return (
    <MapPopup longitude={location.lon} latitude={location.lat} onClose={onClose} offset={POPUP_OFFSET}>
      <div className="mr-6 flex w-full flex-col gap-2">
        <div>
          <h2 className="font-semibold">{member.name}</h2>
          <p>
            {formatDistanceToNow(location.at, { locale: nl, addSuffix: true })}
            {linkStale && ' · laatst bekend'}
          </p>
          {location.driving && <p>Rijdt{location.speedKmh !== null && ` ${formatSpeed(location.speedKmh)}`}</p>}
          <p>
            Batterij: {formatBattery(location.battery ?? undefined)}
            {location.charging && ' (laadt)'}
          </p>
          <p>Nauwkeurigheid: {formatAccuracy(location.accuracyM)}</p>
        </div>
        <GoogleMapsButton lat={location.lat} lng={location.lon} label="Navigeer" />
      </div>
    </MapPopup>
  );
}
