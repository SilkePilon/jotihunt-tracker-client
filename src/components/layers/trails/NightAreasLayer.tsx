import { useMemo } from 'react';
import { Layer, Source, type FillLayerSpecification, type LineLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import type { FeatureCollection, Polygon } from 'geojson';
import { useNightAreas } from '@/hooks/night-areas.hook';
import { NIGHT_AREA_LAYERS, NIGHT_FILL, NIGHT_LINE } from '@/lib/map-layers';
import { useNightDraw } from '@/stores/night-draw.store';
import type { NightAreaKind } from '@/types/Trail';

const SOURCE = 'night-areas';
const [FILL_LAYER, LINE_LAYER, LABEL_LAYER] = NIGHT_AREA_LAYERS;

const FADE = { duration: 300, delay: 0 };
const BY_KIND = (colors: Record<NightAreaKind, string>) => ['match', ['get', 'kind'], 'open', colors.open, colors.closed] as unknown as string;

const LABEL_LAYOUT: SymbolLayerSpecification['layout'] = { 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] };

/**
 * The own night areas from Beheer → Routes, while the Routes card is open or an area is being drawn. Stays mounted
 * and fades (opacity 0 ↔ 1) instead of popping in and out.
 */
export default function NightAreasLayer() {
  const { setting } = useNightAreas();
  const visible = useNightDraw((s) => s.showAreas || s.active);
  const data = useMemo<FeatureCollection<Polygon, { name: string; kind: NightAreaKind }>>(
    () => ({
      type: 'FeatureCollection',
      features: (setting?.areas ?? []).map((area) => ({ type: 'Feature', id: area.id, geometry: area.polygon, properties: { name: area.name, kind: area.kind } })),
    }),
    [setting],
  );
  const opacity = visible ? 1 : 0;
  const fillPaint: FillLayerSpecification['paint'] = { 'fill-color': BY_KIND(NIGHT_FILL), 'fill-opacity': opacity, 'fill-opacity-transition': FADE };
  const linePaint: LineLayerSpecification['paint'] = { 'line-color': BY_KIND(NIGHT_LINE), 'line-width': 1.5, 'line-opacity': opacity, 'line-opacity-transition': FADE };
  const labelPaint: SymbolLayerSpecification['paint'] = {
    'text-color': BY_KIND(NIGHT_LINE),
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.5,
    'text-opacity': opacity,
    'text-opacity-transition': FADE,
  };

  if (!setting) return null;
  return (
    <Source id={SOURCE} type="geojson" data={data}>
      <Layer id={FILL_LAYER} type="fill" paint={fillPaint} />
      <Layer id={LINE_LAYER} type="line" paint={linePaint} />
      <Layer id={LABEL_LAYER} type="symbol" layout={LABEL_LAYOUT} paint={labelPaint} />
    </Source>
  );
}
