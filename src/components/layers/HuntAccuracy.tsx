import { useMemo } from 'react';
import { Layer, Source, type FillLayerSpecification, type LineLayerSpecification } from 'react-map-gl/maplibre';
import { useSyncedHunts } from '@/hooks/hunt-sync.hook';
import { huntAccuracyCircles, HUNT_ACCURACY_ESTIMATE_LINE_LAYER, HUNT_ACCURACY_FILL_LAYER, HUNT_ACCURACY_LINE_LAYER } from '@/lib/map-layers';

const SOURCE = 'hunt-accuracy';
// The app's primary orange: thin outline, 18 % fill
const FILL_PAINT: FillLayerSpecification['paint'] = { 'fill-color': 'hsl(24.6, 95%, 53.1%)', 'fill-opacity': 0.18 };
const LINE_PAINT: LineLayerSpecification['paint'] = { 'line-color': 'hsl(24.6, 95%, 53.1%)', 'line-width': 1.2 };
// Estimated locations (guessed from our trackers): the same outline, dashed
const ESTIMATE_LINE_PAINT: LineLayerSpecification['paint'] = { ...LINE_PAINT, 'line-dasharray': [3, 2.5] };
const EXACT_FILTER: LineLayerSpecification['filter'] = ['!=', ['get', 'estimated'], true];
const ESTIMATE_FILTER: LineLayerSpecification['filter'] = ['==', ['get', 'estimated'], true];

/** Accuracy circles of the synced hunts whose location came with an accuracy (the markers sit on top); estimates get a dashed outline. */
export default function HuntAccuracy() {
  const { hunts } = useSyncedHunts();
  const data = useMemo(() => huntAccuracyCircles(hunts), [hunts]);

  return (
    <Source id={SOURCE} type="geojson" data={data}>
      <Layer id={HUNT_ACCURACY_FILL_LAYER} type="fill" source={SOURCE} paint={FILL_PAINT} />
      <Layer id={HUNT_ACCURACY_LINE_LAYER} type="line" source={SOURCE} filter={EXACT_FILTER} paint={LINE_PAINT} />
      <Layer id={HUNT_ACCURACY_ESTIMATE_LINE_LAYER} type="line" source={SOURCE} filter={ESTIMATE_FILTER} paint={ESTIMATE_LINE_PAINT} />
    </Source>
  );
}
