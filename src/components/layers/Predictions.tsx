import { useMemo } from 'react';
import { PawPrintIcon } from 'lucide-react';
import { Layer, Marker, Source, type LineLayerSpecification } from 'react-map-gl/maplibre';
import { useAreas } from '@/hooks/areas.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { buildPredictionMap } from '@/lib/prediction';
import { cn, getColorFromArea } from '@/lib/utils';

const LINES_SOURCE = 'prediction-lines';
const LINE_LAYOUT: LineLayerSpecification['layout'] = { 'line-cap': 'round' };
const LINE_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.8, 'line-dasharray': [2, 2] };
const PIN_STYLE = { pointerEvents: 'none' } as const;

/** AI prediction: pulsing fox pin per area, dashed line from the last observation. */
export default function Predictions() {
  const { predictions } = usePredictions();
  const { isVisible } = useAreas();

  const data = useMemo(() => buildPredictionMap((predictions ?? []).filter((prediction) => isVisible(prediction.area)), getColorFromArea), [predictions, isVisible]);

  return (
    <>
      <Source id={LINES_SOURCE} type="geojson" data={data.lines}>
        <Layer id="prediction-pin-lines" type="line" source={LINES_SOURCE} layout={LINE_LAYOUT} paint={LINE_PAINT} />
      </Source>
      {data.pins.map((pin) => (
        <Marker key={`pin-${pin.area}`} longitude={pin.lng} latitude={pin.lat} anchor="center" style={PIN_STYLE}>
          <span className={cn('relative flex size-9 items-center justify-center', pin.stale && 'grayscale')}>
            {!pin.stale && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ backgroundColor: pin.color }} />}
            <span className="relative flex size-7 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white" style={{ backgroundColor: pin.color }}>
              <PawPrintIcon className="size-4" aria-label={`Voorspelde positie ${pin.area}`} />
            </span>
          </span>
        </Marker>
      ))}
    </>
  );
}
