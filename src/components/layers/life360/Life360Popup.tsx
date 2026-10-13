import GoogleMapsButton from '@/components/map/GoogleMapsButton';
import MapPopup from '@/components/map/MapPopup';
import { hasUsableAccuracy, life360Age, life360DrivingText } from '@/lib/life360-map';
import { formatAccuracy, formatBattery } from '@/lib/tracker';
import type { Life360Location, Life360Member } from '@/types/Life360';

// Above the 44 px cookie
const POPUP_OFFSET = { bottom: [0, -24] as [number, number] };

interface Life360PopupProps {
  member: Life360Member;
  location: Life360Location;
  /** The link is logged out or paused: this is the last known position */
  linkStale: boolean;
  /** The layer's stale tick, so the popup and the marker agree on stale */
  now: number;
  onClose: () => void;
}

/** Like the hunter popup: name, age, driving speed, battery, accuracy, Navigeer. */
export default function Life360Popup({ member, location, linkStale, now, onClose }: Life360PopupProps) {
  const driving = life360DrivingText(location, linkStale, now);
  return (
    <MapPopup longitude={location.lon} latitude={location.lat} onClose={onClose} offset={POPUP_OFFSET}>
      <div className="mr-6 flex w-full flex-col gap-2">
        <div>
          <h2 className="font-semibold">{member.name}</h2>
          <p>
            {life360Age(location.at) ?? 'onbekend'}
            {linkStale && ' · laatst bekend'}
          </p>
          {driving && <p>{driving}</p>}
          <p>
            Batterij: {formatBattery(location.battery ?? undefined)}
            {location.charging && ' (laadt)'}
          </p>
          {hasUsableAccuracy(location.accuracyM) && <p>Nauwkeurigheid: {formatAccuracy(location.accuracyM)}</p>}
        </div>
        <GoogleMapsButton lat={location.lat} lng={location.lon} label="Navigeer" />
      </div>
    </MapPopup>
  );
}
