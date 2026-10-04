import MapTooltip from '@/components/map/MapTooltip';
import { Badge } from '@/components/ui/badge';
import { formatMarkerTime } from '@/lib/markers';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { Marker as FoxMarker } from '@/types/Marker';

// Above the hovered fox (28px icon, centred), where the Radix tooltip used to be
const TOOLTIP_OFFSET: [number, number] = [0, -25];

/** Hover tooltip of a fox marker (same content and look as the former per-marker Radix tooltip). */
export default function MarkerTooltip({ marker }: { marker: FoxMarker }) {
  const [lng, lat] = marker.location.coordinates;
  return (
    <MapTooltip longitude={lng} latitude={lat} offset={TOOLTIP_OFFSET}>
      <div>
        {capitalizeFirstLetter(marker.type)} - {formatMarkerTime(marker.time)}
      </div>
      <Badge className="text-white border-0" style={{ backgroundColor: getColorFromArea(marker.area) }}>
        {capitalizeFirstLetter(marker.area)}
      </Badge>
    </MapTooltip>
  );
}
