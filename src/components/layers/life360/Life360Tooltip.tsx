import MapTooltip from '@/components/map/MapTooltip';
import { formatAgeShort } from '@/lib/life360';
import { life360AccuracyColor, life360Tone } from '@/lib/life360-map';
import type { Life360Location, Life360Member } from '@/types/Life360';

// Above the hovered 44 px cookie
const TOOLTIP_OFFSET: [number, number] = [0, -28];

/** Hover tooltip of a Life360 member: rim colour (live / driving / stale), name, how long ago. */
export default function Life360Tooltip({ member, location, linkStale, now }: { member: Life360Member; location: Life360Location; linkStale: boolean; now: number }) {
  return (
    <MapTooltip
      longitude={location.lon}
      latitude={location.lat}
      offset={TOOLTIP_OFFSET}
      color={life360AccuracyColor(life360Tone(location, linkStale, now))}
      title={member.name}
      meta={formatAgeShort(location.at, now)}
    />
  );
}
