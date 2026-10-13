import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { BatteryIcon, GaugeIcon } from 'lucide-react';
import MapPopup from '../../map/MapPopup';
import MarkerRegistration from '../../map/MarkerRegistration';
import MarkerGlyph from '../../map/popup/MarkerGlyph';
import { MapsAction, PopupActions } from '../../map/popup/PopupActions';
import { FactDot, PopupFact, PopupFacts } from '../../map/popup/PopupFacts';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { formatBattery, formatSpeed } from '@/lib/tracker';
import { joinParts } from '@/lib/format';
import { vehicleGlyph, type HunterIcon } from '@/lib/marker-style';
import { isMoreThanFiveMinutesAgo, knotsToKmh } from '@/lib/utils';
import type { Position } from '@/types/Position';
import { useMarkerPalette } from '../marker-icons';

const POPUP_OFFSET = { bottom: [0, -20] as [number, number] };

interface DevicePopupProps {
  /** The device's position from the current SWR data */
  position: Position;
  /** The hunter's vehicle icon, as on the map */
  icon: HunterIcon;
  onClose: () => void;
}

/** Age, distance, speed and battery of a hunter, plus Google Maps and "register a hunt / spot here". */
export default function DevicePopup({ position, icon, onClose }: DevicePopupProps) {
  const { latitude: lat, longitude: lng } = position;
  const palette = useMarkerPalette();
  const distance = useDistanceFromMe(lat, lng);
  const stale = isMoreThanFiveMinutesAgo(position.fixTime);
  const age = formatDistanceToNow(position.fixTime, { locale: nl, addSuffix: true });

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader
        icon={
          <PopupIcon background={palette.secondaryContainer} color={palette.onSecondaryContainer}>
            <MarkerGlyph name={vehicleGlyph(icon)} />
          </PopupIcon>
        }
        title={position.deviceName}
        subtitle={joinParts(age, stale ? 'laatst bekend' : distance)}
        stale={stale}
      />
      <PopupFacts>
        <PopupFact>
          {!stale && (
            <>
              <GaugeIcon />
              {formatSpeed(knotsToKmh(position.speed))}
              <FactDot />
            </>
          )}
          <BatteryIcon />
          {formatBattery(position.attributes.batteryLevel)}
        </PopupFact>
      </PopupFacts>
      <PopupActions>
        <MapsAction lat={lat} lng={lng} />
        <MarkerRegistration lat={lat} lng={lng} />
      </PopupActions>
    </MapPopup>
  );
}
