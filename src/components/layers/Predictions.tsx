import { useMemo } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { FilterSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useAreas } from '@/hooks/areas.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { buildPredictionGeoJson } from '@/lib/prediction';
import { getColorFromArea } from '@/lib/utils';

// Routed zones get a solid border; estimates (straight-line fallback) and transit islands a dashed one
const SOLID_OUTLINE: FilterSpecification = ['all', ['!=', ['get', 'kind'], 'island'], ['==', ['get', 'estimate'], false]];
const DASHED_OUTLINE: FilterSpecification = ['any', ['==', ['get', 'kind'], 'island'], ['==', ['get', 'estimate'], true]];

export default function Predictions() {
  const { predictions } = usePredictions();
  const { hiddenAreas } = useAreas();

  const data = useMemo(
    () => buildPredictionGeoJson((predictions ?? []).filter((prediction) => !hiddenAreas.includes(prediction.area.toLowerCase())), getColorFromArea),
    [predictions, hiddenAreas],
  );

  return (
    <>
      <Source id="prediction-zones" type="geojson" data={data.zones}>
        <Layer
          id="prediction-zone-fill"
          type="fill"
          paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': ['match', ['get', 'kind'], 'core', 0.35, 0.15] }}
        />
        <Layer id="prediction-zone-outline" type="line" filter={SOLID_OUTLINE} paint={{ 'line-color': ['get', 'color'], 'line-width': 1.5 }} />
        <Layer
          id="prediction-zone-outline-dashed"
          type="line"
          filter={DASHED_OUTLINE}
          paint={{ 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-dasharray': [2, 2] }}
        />
      </Source>
      <Source id="prediction-lines" type="geojson" data={data.lines}>
        <Layer
          id="prediction-candidate-lines"
          type="line"
          layout={{ 'line-cap': 'round' }}
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['get', 'probability'], 0, 1.5, 1, 5],
            'line-opacity': 0.85,
          }}
        />
      </Source>
      {data.labels.map((label) => (
        <Marker key={label.key} longitude={label.lng} latitude={label.lat} anchor="center">
          <span
            className="pointer-events-none whitespace-nowrap rounded-full border-2 bg-background/90 px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm"
            style={{ borderColor: label.color }}
          >
            {label.text}
          </span>
        </Marker>
      ))}
    </>
  );
}
