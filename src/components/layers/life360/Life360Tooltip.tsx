import MapTooltip from '@/components/map/MapTooltip';
import { Badge } from '@/components/ui/badge';
import { life360Age } from '@/lib/life360-map';
import type { Life360Location, Life360Member } from '@/types/Life360';

// Above the hovered 44 px cookie
const TOOLTIP_OFFSET: [number, number] = [0, -28];

/** Hover tooltip of a Life360 member, like the hunters' one. */
export default function Life360Tooltip({ member, location }: { member: Life360Member; location: Life360Location }) {
  return (
    <MapTooltip longitude={location.lon} latitude={location.lat} offset={TOOLTIP_OFFSET}>
      <span className="text-sm font-medium">{member.name}</span>
      <Badge>{life360Age(location.at) ?? 'onbekend'}</Badge>
    </MapTooltip>
  );
}
