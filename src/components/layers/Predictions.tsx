import { useMemo } from 'react';
import { Layer, Source, type LineLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { useAreas } from '@/hooks/areas.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { PREDICTION_PINS_LAYER, predictionPinFeatures } from '@/lib/map-layers';
import { themedIconExpression } from '@/lib/marker-style';
import { buildPredictionMap } from '@/lib/prediction';
import { getColorFromArea } from '@/lib/utils';
import { useMarkerTheme } from './marker-icons';

const LINES_SOURCE = 'prediction-lines';
const LINE_LAYOUT: LineLayerSpecification['layout'] = { 'line-cap': 'round' };
const LINE_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.8, 'line-dasharray': [2, 2] };
const PINS_SOURCE = 'prediction-pins';

/** AI prediction: a fox pin per area (greyed out when stale), dashed line from the last observation. */
export default function Predictions() {
  const { predictions } = usePredictions();
  const { isVisible } = useAreas();
  const theme = useMarkerTheme();

  const data = useMemo(() => buildPredictionMap((predictions ?? []).filter((prediction) => isVisible(prediction.area)), getColorFromArea), [predictions, isVisible]);
  const pins = useMemo(() => predictionPinFeatures(data.pins), [data.pins]);
  const pinLayout = useMemo<SymbolLayerSpecification['layout']>(() => ({ 'icon-image': themedIconExpression(theme), 'icon-allow-overlap': true, 'icon-ignore-placement': true }), [theme]);

  return (
    <>
      <Source id={LINES_SOURCE} type="geojson" data={data.lines}>
        <Layer id="prediction-pin-lines" type="line" source={LINES_SOURCE} layout={LINE_LAYOUT} paint={LINE_PAINT} />
      </Source>
      {/* Not clickable (not one of Map.tsx's interactive layers), like the former HTML pins */}
      <Source id={PINS_SOURCE} type="geojson" data={pins}>
        <Layer id={PREDICTION_PINS_LAYER} type="symbol" source={PINS_SOURCE} layout={pinLayout} />
      </Source>
    </>
  );
}
