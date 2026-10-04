import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import MapTooltip from '@/components/map/MapTooltip';
import { Badge } from '@/components/ui/badge';
import type { Position } from '@/types/Position';

// Above the hovered hunter (40px icon, centred), where the Radix tooltip used to be
const TOOLTIP_OFFSET: [number, number] = [0, -30];

/** Hover tooltip of a hunter (same content and look as the former per-marker Radix tooltip); follows every poll. */
export default function DeviceTooltip({ position }: { position: Position }) {
  return (
    <MapTooltip longitude={position.longitude} latitude={position.latitude} offset={TOOLTIP_OFFSET}>
      <span className="text-sm font-medium">{position.deviceName}</span>
      <Badge>{formatDistanceToNow(position.fixTime, { locale: nl, addSuffix: true })}</Badge>
    </MapTooltip>
  );
}
