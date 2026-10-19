import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { BatteryIcon, GaugeIcon } from 'lucide-react';
import MapPopup from '../../map/MapPopup';
import MarkerRegistration from '../../map/MarkerRegistration';
import MarkerGlyph from '../../map/popup/MarkerGlyph';
import { PopupActions, RouteAction } from '../../map/popup/PopupActions';
import { PopupRow, PopupRowSplit, PopupRows } from '../../map/popup/PopupRows';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { formatBattery, formatSpeed, isActive } from '@/lib/tracker';
import { joinParts } from '@/lib/format';
import { vehicleGlyph, type HunterIcon } from '@/lib/marker-style';
import { knotsToKmh } from '@/lib/utils';
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

/** Age, distance, speed and battery of a hunter, plus Route and "register a hunt / spot here". */
export default function DevicePopup({ position, icon, onClose }: DevicePopupProps) {
  const { latitude: lat, longitude: lng } = position;
  const palette = useMarkerPalette();
  const distance = useDistanceFromMe(lat, lng);
  const stale = !isActive(position.fixTime);
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
      <PopupRows>
        <PopupRowSplit>
          {!stale && <PopupRow icon={<GaugeIcon />} title={formatSpeed(knotsToKmh(position.speed))} />}
          <PopupRow icon={<BatteryIcon />} title={formatBattery(position.attributes.batteryLevel)} />
        </PopupRowSplit>
      </PopupRows>
      <PopupActions>
        <RouteAction lat={lat} lng={lng} compact />
        <MarkerRegistration lat={lat} lng={lng} />
      </PopupActions>
    </MapPopup>
  );
}
