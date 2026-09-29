import { useMemo } from 'react';
import { PawPrintIcon } from 'lucide-react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import { useAreas } from '@/hooks/areas.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { buildPredictionMap } from '@/lib/prediction';
import { cn, getColorFromArea } from '@/lib/utils';

/** AI prediction: pulsing fox pin per area, dashed line from the last observation, ring + "62% 14:20" badge on the top groups. */
export default function Predictions() {
  const { predictions } = usePredictions();
  const { hiddenAreas } = useAreas();

  const data = useMemo(
    () => buildPredictionMap((predictions ?? []).filter((prediction) => !hiddenAreas.includes(prediction.area.toLowerCase())), getColorFromArea),
    [predictions, hiddenAreas],
  );

  return (
    <>
      <Source id="prediction-lines" type="geojson" data={data.lines}>
        <Layer
          id="prediction-pin-lines"
          type="line"
          layout={{ 'line-cap': 'round' }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.8, 'line-dasharray': [2, 2] }}
        />
      </Source>
      {data.badges.map((badge) => (
        <Marker key={badge.key} longitude={badge.lng} latitude={badge.lat} anchor="center" style={{ pointerEvents: 'none' }}>
          <span className={cn('relative flex flex-col items-center', badge.stale && 'grayscale opacity-50')}>
            <span className={cn('rounded-full border-[3px]', badge.rank === 0 ? 'size-11' : 'size-9 opacity-70')} style={{ borderColor: badge.color }} />
            <span
              className="absolute top-full mt-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white shadow"
              style={{ backgroundColor: badge.color, opacity: badge.rank === 0 ? 1 : 0.8 }}
            >
              {badge.text}
            </span>
          </span>
        </Marker>
      ))}
      {data.pins.map((pin) => (
        <Marker key={`pin-${pin.area}`} longitude={pin.lng} latitude={pin.lat} anchor="center" style={{ pointerEvents: 'none' }}>
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
