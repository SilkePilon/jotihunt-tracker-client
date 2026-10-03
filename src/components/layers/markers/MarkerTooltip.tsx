import { Marker } from 'react-map-gl/maplibre';
import { Badge } from '@/components/ui/badge';
import { formatMarkerTime } from '@/lib/markers';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { Marker as FoxMarker } from '@/types/Marker';

// Above the hovered fox (28px icon, centred); never catches the pointer itself
const TOOLTIP_OFFSET: [number, number] = [0, -18];
const TOOLTIP_STYLE = { pointerEvents: 'none', zIndex: 40 } as const;

/** Hover tooltip of a fox marker (same content and look as the former per-marker Radix tooltip). */
export default function MarkerTooltip({ marker }: { marker: FoxMarker }) {
  const [lng, lat] = marker.location.coordinates;
  return (
    <Marker longitude={lng} latitude={lat} anchor="bottom" offset={TOOLTIP_OFFSET} style={TOOLTIP_STYLE}>
      <div className="flex w-fit items-center gap-2 rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
        <div>
          {capitalizeFirstLetter(marker.type)} - {formatMarkerTime(marker.time)}
        </div>
        <Badge className="text-white border-0" style={{ backgroundColor: getColorFromArea(marker.area) }}>
          {capitalizeFirstLetter(marker.area)}
        </Badge>
      </div>
    </Marker>
  );
}
