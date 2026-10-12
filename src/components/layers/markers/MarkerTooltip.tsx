import MapTooltip from '@/components/map/MapTooltip';
import { Badge } from '@/components/ui/badge';
import { formatMarkerTime } from '@/lib/markers';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { Marker as FoxMarker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

// Above the hovered fox (38px shape, centred), or above a hint's label (which hangs ~29px above its point)
const TOOLTIP_OFFSET: [number, number] = [0, -25];
const HINT_TOOLTIP_OFFSET: [number, number] = [0, -34];

/** Hover tooltip of a fox marker (same content and look as the former per-marker Radix tooltip). */
export default function MarkerTooltip({ marker }: { marker: FoxMarker }) {
  const [lng, lat] = marker.location.coordinates;
  return (
    <MapTooltip longitude={lng} latitude={lat} offset={marker.type === MarkerType.Hint ? HINT_TOOLTIP_OFFSET : TOOLTIP_OFFSET}>
      <div>
        {capitalizeFirstLetter(marker.type)} - {formatMarkerTime(marker.time)}
      </div>
      <Badge className="text-white border-0" style={{ backgroundColor: getColorFromArea(marker.area) }}>
        {capitalizeFirstLetter(marker.area)}
      </Badge>
    </MapTooltip>
  );
}
