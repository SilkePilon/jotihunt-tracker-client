import { useEffect, useMemo, useState } from 'react';
import { Layer, Source, useMap, type LineLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import type { ExpressionSpecification } from 'maplibre-gl';
import { useTrails } from '@/hooks/trails.hook';
import { ROUTED_TRAIL_LAYERS, TRAILS_HIT_LAYER } from '@/lib/map-layers';
import { visibleTrails } from '@/lib/trails';
import { getColorFromArea } from '@/lib/utils';
import { featureId, useLayerInteractions, usePopupSelection } from '../map-interactions';
import LegPopup from './LegPopup';
import { addTrailBadge } from './trail-badges';

const SOURCE = 'marker-trails-routed';
const [CASING_LAYER, WALK_LAYER, CAR_LAYER, FALLBACK_LAYER, , BADGE_LAYER] = ROUTED_TRAIL_LAYERS;
const HIT_LAYERS = [TRAILS_HIT_LAYER];

const LINE_LAYOUT: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round' };
const NOT_FALLBACK: ExpressionSpecification = ['!', ['get', 'fallback']];
const WALK_FILTER: ExpressionSpecification = ['all', NOT_FALLBACK, ['==', ['get', 'mode'], 'walk']];
const CAR_FILTER: ExpressionSpecification = ['all', NOT_FALLBACK, ['!=', ['get', 'mode'], 'walk']];
const FALLBACK_FILTER: ExpressionSpecification = ['==', ['get', 'fallback'], true];
const BADGE_FILTER: ExpressionSpecification = ['!=', ['get', 'badge'], null];

const CASING_PAINT: LineLayerSpecification['paint'] = { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.9 };
// Cross-fade when a leg flips between walk and car
const WALK_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity-transition': { duration: 400, delay: 0 } };
// Round caps on near-zero dashes: dots
const CAR_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-dasharray': [0.1, 2], 'line-opacity-transition': { duration: 400, delay: 0 } };
const FALLBACK_PAINT: LineLayerSpecification['paint'] = { 'line-color': '#a8a29e', 'line-width': 2, 'line-dasharray': [1, 2] };
const HIT_PAINT: LineLayerSpecification['paint'] = { 'line-color': '#000000', 'line-width': 16, 'line-opacity': 0 };
const BADGE_LAYOUT: SymbolLayerSpecification['layout'] = {
  'symbol-placement': 'line-center',
  'icon-image': ['get', 'badge'],
  'icon-size': 1,
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  'icon-rotation-alignment': 'viewport',
};

/** Routed fox trails (style A): walk solid with a white casing, car dotted with a car badge, router-less legs grey and straight. Click a leg for its popup. */
export default function TrailLayers({ visibleIds }: { visibleIds: Set<string> }) {
  const map = useMap().current?.getMap();
  const { data, setLegMode } = useTrails();
  const trails = useMemo(() => (data ? visibleTrails(data.trails, visibleIds, getColorFromArea) : undefined), [data, visibleIds]);
  const { active, open, close } = usePopupSelection<string>();
  const [anchor, setAnchor] = useState<[number, number]>();

  // Badges are drawn on demand, one per mode + area colour
  useEffect(() => {
    if (!map) return;
    const onMissing = (e: { id: string }) => {
      addTrailBadge(map, e.id);
    };
    map.on('styleimagemissing', onMissing);
    return () => {
      map.off('styleimagemissing', onMissing);
    };
  }, [map]);

  useLayerInteractions(map, HIT_LAYERS, {
    onClick: (feature, event) => {
      const id = featureId(feature);
      if (typeof id !== 'string') return;
      setAnchor([event.lngLat.lng, event.lngLat.lat]);
      open(id);
    },
  });

  // From the current data, so the popup follows a flip (and closes once the leg is gone)
  const activeLeg = active ? trails?.features.find((feature) => feature.properties.id === active.id) : undefined;
  if (!trails) return null;
  return (
    <>
      <Source id={SOURCE} type="geojson" data={trails}>
        <Layer id={CASING_LAYER} type="line" filter={NOT_FALLBACK} layout={LINE_LAYOUT} paint={CASING_PAINT} />
        <Layer id={WALK_LAYER} type="line" filter={WALK_FILTER} layout={LINE_LAYOUT} paint={WALK_PAINT} />
        <Layer id={CAR_LAYER} type="line" filter={CAR_FILTER} layout={LINE_LAYOUT} paint={CAR_PAINT} />
        <Layer id={FALLBACK_LAYER} type="line" filter={FALLBACK_FILTER} layout={LINE_LAYOUT} paint={FALLBACK_PAINT} />
        <Layer id={TRAILS_HIT_LAYER} type="line" layout={LINE_LAYOUT} paint={HIT_PAINT} />
        <Layer id={BADGE_LAYER} type="symbol" filter={BADGE_FILTER} layout={BADGE_LAYOUT} />
      </Source>
      {activeLeg && anchor && <LegPopup key={active!.opened} leg={activeLeg.properties} longitude={anchor[0]} latitude={anchor[1]} onClose={close} onSetMode={setLegMode} />}
    </>
  );
}
