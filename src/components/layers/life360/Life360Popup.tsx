import { BatteryIcon, CrosshairIcon, GaugeIcon } from 'lucide-react';
import Life360Avatar from '@/components/cards/life360/Life360Avatar';
import MapPopup from '@/components/map/MapPopup';
import { MapsAction, PopupActions } from '@/components/map/popup/PopupActions';
import { FactDot, PopupFact, PopupFacts } from '@/components/map/popup/PopupFacts';
import PopupHeader from '@/components/map/popup/PopupHeader';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { joinParts } from '@/lib/format';
import { isLocationStale } from '@/lib/life360';
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

/** Like the hunter popup: age, distance, driving speed, battery, accuracy, Navigeer. */
export default function Life360Popup({ member, location, linkStale, now, onClose }: Life360PopupProps) {
  const driving = life360DrivingText(location, linkStale, now);
  const stale = isLocationStale(location, linkStale, now);
  const distance = useDistanceFromMe(location.lat, location.lon);
  const battery = `${formatBattery(location.battery ?? undefined)}${location.charging ? ' (laadt)' : ''}`;

  return (
    <MapPopup longitude={location.lon} latitude={location.lat} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader
        icon={<Life360Avatar member={member} size={32} />}
        title={member.name}
        subtitle={joinParts(life360Age(location.at, now) ?? 'onbekend', stale ? 'laatst bekend' : distance)}
        stale={stale}
      />
      <PopupFacts>
        <PopupFact>
          {driving && (
            <>
              <GaugeIcon />
              {driving.toLowerCase()}
              <FactDot />
            </>
          )}
          <BatteryIcon />
          {battery}
        </PopupFact>
        {hasUsableAccuracy(location.accuracyM) && (
          <PopupFact>
            <CrosshairIcon />
            {formatAccuracy(location.accuracyM)} nauwkeurig
          </PopupFact>
        )}
      </PopupFacts>
      <PopupActions>
        <MapsAction lat={location.lat} lng={location.lon} label="Navigeer" />
      </PopupActions>
    </MapPopup>
  );
}
