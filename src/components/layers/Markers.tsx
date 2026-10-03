import { useCallback, useMemo, useState } from 'react';
import { Layer, Source, type LineLayerSpecification } from 'react-map-gl/maplibre';
import { useMarkers } from '@/hooks/markers.hook';
import { useAreas } from '@/hooks/areas.hook';
import { trailLines } from '@/lib/map-layers';
import { filterMarkers, groupMarkersByArea, markerSplitTime } from '@/lib/markers';
import MarkerPin from './markers/MarkerPin';
import MarkerPopup from './markers/MarkerPopup';

// Split between the two marker layers (static for the lifetime of the app): 23:00 on the first hunt day
const SPLIT = markerSplitTime(new Date(import.meta.env.HUNT_START_TIME));

const TRAILS_SOURCE = 'marker-trails';
const TRAILS_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 3 };

interface MarkersProps {
  /** Show markers before 23:00 on the first hunt day */
  part1: boolean;
  /** Show markers from 23:00 on the first hunt day */
  part2: boolean;
}

export default function Markers({ part1, part2 }: MarkersProps) {
  const { markers, deleteMarker } = useMarkers();
  const { isVisible } = useAreas();

  const [activeMarkerId, setActiveMarkerId] = useState<string>();
  // Derived from the current data, so the popup never shows a stale copy (and closes once the marker is deleted)
  const activeMarker = activeMarkerId !== undefined ? markers?.find((marker) => marker._id === activeMarkerId) : undefined;

  const visibleMarkers = useMemo(() => filterMarkers(markers ?? [], { part1, part2, split: SPLIT, isVisible }), [markers, part1, part2, isVisible]);
  const trails = useMemo(() => trailLines(groupMarkersByArea(visibleMarkers)), [visibleMarkers]);

  const selectMarker = useCallback((id: string) => setActiveMarkerId(id), []);
  const closePopup = useCallback(() => setActiveMarkerId(undefined), []);

  return (
    <>
      {visibleMarkers.map((marker) => (
        <MarkerPin
          key={marker._id}
          id={marker._id!}
          longitude={marker.location.coordinates[0]}
          latitude={marker.location.coordinates[1]}
          type={marker.type}
          area={marker.area}
          time={new Date(marker.time).getTime()}
          tooltipsDisabled={activeMarker !== undefined}
          onSelect={selectMarker}
        />
      ))}
      <Source id={TRAILS_SOURCE} type="geojson" data={trails}>
        <Layer id="marker-trails-line" type="line" source={TRAILS_SOURCE} paint={TRAILS_PAINT} />
      </Source>
      {activeMarker && <MarkerPopup marker={activeMarker} onClose={closePopup} deleteMarker={deleteMarker} />}
    </>
  );
}
