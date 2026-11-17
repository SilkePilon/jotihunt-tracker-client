import CopyButton from '@/components/CopyButton';
import { formatCoordinates } from '@/lib/hunters';
import { rdText } from '@/lib/rd';
import { PopupRow, PopupRows } from './PopupRows';

const COPIED = 'Coördinaten gekopieerd naar klembord!';

/**
 * WGS84 (5 decimals shown, 7 copied) and RD rows with copy buttons. (The picked-location popup puts the RD coordinates
 * into the hint registration with its labelled "In hint" action.)
 */
export default function CoordRows({ lat, lng }: { lat: number; lng: number }) {
  const rd = rdText(lng, lat);

  return (
    <PopupRows>
      <PopupRow label="WGS84" title={formatCoordinates(lat, lng)} trailing={<CopyButton value={`${lat.toFixed(7)}, ${lng.toFixed(7)}`} label="Coördinaten" successMessage={COPIED} variant="ghost" />} />
      <PopupRow
        label="RD"
        title={`${rd.x} · ${rd.y}`}
        trailing={<CopyButton value={`${rd.x}, ${rd.y}`} label="RD-coördinaten" successMessage={COPIED} variant="ghost" />}
      />
    </PopupRows>
  );
}
