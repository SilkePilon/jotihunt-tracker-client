import MapTooltip from '@/components/map/MapTooltip';
import { useSyncedHunts } from '@/hooks/hunt-sync.hook';
import { formatClock, joinParts } from '@/lib/format';
import { huntLocationNote, syncedHuntForMarker } from '@/lib/hunt-sync';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { Marker as FoxMarker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

// Above the hovered fox (38px shape, centred), or above a hint's label (which hangs ~29px above its point)
const TOOLTIP_OFFSET: [number, number] = [0, -25];
const HINT_TOOLTIP_OFFSET: [number, number] = [0, -34];

/** Hover tooltip of a fox marker: area colour, type, area and time (+ "Geschatte locatie · via Jonas" for a hunt placed from our trackers). */
export default function MarkerTooltip({ marker }: { marker: FoxMarker }) {
  const [lng, lat] = marker.location.coordinates;
  const { hunts } = useSyncedHunts();
  const locationNote = huntLocationNote(syncedHuntForMarker(marker, hunts)?.location);
  return (
    <MapTooltip
      longitude={lng}
      latitude={lat}
      offset={marker.type === MarkerType.Hint ? HINT_TOOLTIP_OFFSET : TOOLTIP_OFFSET}
      color={getColorFromArea(marker.area)}
      title={capitalizeFirstLetter(marker.type)}
      meta={joinParts(capitalizeFirstLetter(marker.area), formatClock(marker.time), locationNote)}
    />
  );
}
