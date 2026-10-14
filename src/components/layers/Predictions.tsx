import { useMemo } from 'react';
import { Layer, Source, type FillLayerSpecification, type LineLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { useAreas } from '@/hooks/areas.hook';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { predictionAreaCircles, PREDICTION_PINS_LAYER, predictionPinFeatures } from '@/lib/map-layers';
import { themedIconExpression, type MarkerPalette } from '@/lib/marker-style';
import { buildPredictionMap } from '@/lib/prediction';
import { getColorFromArea } from '@/lib/utils';
import { useMarkerPalette, useMarkerTheme } from './marker-icons';

const LINES_SOURCE = 'prediction-lines';
const LINE_LAYOUT: LineLayerSpecification['layout'] = { 'line-cap': 'round' };
const AREAS_SOURCE = 'prediction-areas';

// Like the Android app: everything about the prediction in the tertiary colour. A dashed line from the last observation
// to the pin, and a dashed circle (lightly filled) where the fox probably is.
function predictionPaint({ tertiary }: MarkerPalette) {
  return {
    line: { 'line-color': tertiary, 'line-width': 2.5, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } satisfies LineLayerSpecification['paint'],
    areaFill: { 'fill-color': tertiary, 'fill-opacity': 0.1 } satisfies FillLayerSpecification['paint'],
    areaLine: { 'line-color': tertiary, 'line-width': 2, 'line-dasharray': [2, 1.5] } satisfies LineLayerSpecification['paint'],
  };
}
const PINS_SOURCE = 'prediction-pins';

/** AI prediction: a fox pin per area (greyed out when stale), its likely area, dashed line from the last observation. */
export default function Predictions() {
  const { predictions } = usePredictions();
  const { isVisible } = useAreas();
  const { isForbidden } = useHuntableAreas();
  const theme = useMarkerTheme();
  const palette = useMarkerPalette();
  const paint = useMemo(() => predictionPaint(palette), [palette]);

  const data = useMemo(() => buildPredictionMap((predictions ?? []).filter((prediction) => isVisible(prediction.area)), getColorFromArea), [predictions, isVisible]);
  const pins = useMemo(() => predictionPinFeatures(data.pins, isForbidden), [data.pins, isForbidden]);
  const areas = useMemo(() => predictionAreaCircles(data.pins), [data.pins]);
  const pinLayout = useMemo<SymbolLayerSpecification['layout']>(() => ({ 'icon-image': themedIconExpression(theme), 'icon-allow-overlap': true, 'icon-ignore-placement': true }), [theme]);

  return (
    <>
      <Source id={AREAS_SOURCE} type="geojson" data={areas}>
        <Layer id="prediction-areas-fill" type="fill" source={AREAS_SOURCE} paint={paint.areaFill} />
        <Layer id="prediction-areas-line" type="line" source={AREAS_SOURCE} paint={paint.areaLine} />
      </Source>
      <Source id={LINES_SOURCE} type="geojson" data={data.lines}>
        <Layer id="prediction-pin-lines" type="line" source={LINES_SOURCE} layout={LINE_LAYOUT} paint={paint.line} />
      </Source>
      {/* Not clickable (not one of Map.tsx's interactive layers), like the former HTML pins */}
      <Source id={PINS_SOURCE} type="geojson" data={pins}>
        <Layer id={PREDICTION_PINS_LAYER} type="symbol" source={PINS_SOURCE} layout={pinLayout} />
      </Source>
    </>
  );
}
