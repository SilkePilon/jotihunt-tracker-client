import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Layer, Source, useMap, type LineLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import type { ExpressionSpecification } from 'maplibre-gl';
import { useTrails } from '@/hooks/trails.hook';
import { ROUTED_TRAIL_LAYERS, TRAILS_HIT_LAYER } from '@/lib/map-layers';
import { badgePoints, changedLegIds, legLooks, visibleTrails, type LegLooks } from '@/lib/trails';
import { getColorFromArea } from '@/lib/utils';
import { featureId, useLayerInteractions, usePopupSelection } from '../map-interactions';
import LegPopup from './LegPopup';
import { addTrailBadge } from './trail-badges';

const SOURCE = 'marker-trails-routed';
const BADGE_SOURCE = 'marker-trails-badges';
const [CASING_LAYER, WALK_LAYER, CAR_LAYER, FALLBACK_LAYER, , BADGE_LAYER] = ROUTED_TRAIL_LAYERS;
const HIT_LAYERS = [TRAILS_HIT_LAYER];

const LINE_LAYOUT: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round' };
const NOT_FALLBACK: ExpressionSpecification = ['!', ['get', 'fallback']];
const WALK_FILTER: ExpressionSpecification = ['all', NOT_FALLBACK, ['==', ['get', 'mode'], 'walk']];
const CAR_FILTER: ExpressionSpecification = ['all', NOT_FALLBACK, ['!=', ['get', 'mode'], 'walk']];
const FALLBACK_FILTER: ExpressionSpecification = ['==', ['get', 'fallback'], true];

// Fade of a leg that is new or flipped (walk/car/fallback): a per-leg feature-state stepped 0 → 1 over FADE_MS.
// Paint transitions do not run on feature-state changes, so the fade is driven frame by frame.
const FADE_MS = 400;
const FADE: ExpressionSpecification = ['number', ['feature-state', 'fade'], 1];
const faded = (opacity: number): ExpressionSpecification => (opacity === 1 ? FADE : ['*', opacity, FADE]);

const CASING_PAINT: LineLayerSpecification['paint'] = { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': faded(0.9) };
const WALK_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity': FADE };
// Round caps on near-zero dashes: dots
const CAR_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-dasharray': [0.1, 2], 'line-opacity': FADE };
const FALLBACK_PAINT: LineLayerSpecification['paint'] = { 'line-color': '#a8a29e', 'line-width': 2, 'line-dasharray': [1, 2], 'line-opacity': FADE };
const BADGE_PAINT: SymbolLayerSpecification['paint'] = { 'icon-opacity': FADE };
const HIT_PAINT: LineLayerSpecification['paint'] = { 'line-color': '#000000', 'line-width': 16, 'line-opacity': 0 };
const BADGE_LAYOUT: SymbolLayerSpecification['layout'] = {
  'symbol-placement': 'point',
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
  const badges = useMemo(() => (trails ? badgePoints(trails) : undefined), [trails]);
  const { active, open, close } = usePopupSelection<string>();
  const [anchor, setAnchor] = useState<[number, number]>();
  const reduceMotion = useReducedMotion();
  const looks = useRef<LegLooks | null>(null);

  // Fade in legs that appear or flip after the first render (the first load just shows everything)
  useEffect(() => {
    if (!map || !trails) return;
    const next = legLooks(trails.features);
    const previous = looks.current;
    looks.current = next;
    if (!previous || reduceMotion) return;
    const ids = changedLegIds(previous, next);
    if (!ids.length) return;
    const setFade = (fade: number) => {
      for (const source of [SOURCE, BADGE_SOURCE]) {
        if (!map.getSource(source)) continue;
        for (const id of ids) map.setFeatureState({ source, id }, { fade });
      }
    };
    setFade(0);
    const start = performance.now();
    let frame = requestAnimationFrame(function step(time) {
      const t = Math.min(1, (time - start) / FADE_MS);
      setFade(t * (2 - t)); // ease-out
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      // Next data (or unmount) mid-fade: never leave a leg half-transparent
      cancelAnimationFrame(frame);
      setFade(1);
    };
  }, [map, trails, reduceMotion]);

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
  if (!trails || !badges) return null;
  return (
    <>
      <Source id={SOURCE} type="geojson" data={trails} promoteId="id">
        <Layer id={CASING_LAYER} type="line" filter={NOT_FALLBACK} layout={LINE_LAYOUT} paint={CASING_PAINT} />
        <Layer id={WALK_LAYER} type="line" filter={WALK_FILTER} layout={LINE_LAYOUT} paint={WALK_PAINT} />
        <Layer id={CAR_LAYER} type="line" filter={CAR_FILTER} layout={LINE_LAYOUT} paint={CAR_PAINT} />
        <Layer id={FALLBACK_LAYER} type="line" filter={FALLBACK_FILTER} layout={LINE_LAYOUT} paint={FALLBACK_PAINT} />
        <Layer id={TRAILS_HIT_LAYER} type="line" layout={LINE_LAYOUT} paint={HIT_PAINT} />
      </Source>
      <Source id={BADGE_SOURCE} type="geojson" data={badges} promoteId="id">
        <Layer id={BADGE_LAYER} type="symbol" layout={BADGE_LAYOUT} paint={BADGE_PAINT} />
      </Source>
      {activeLeg && anchor && <LegPopup key={active!.opened} leg={activeLeg.properties} longitude={anchor[0]} latitude={anchor[1]} onClose={close} onSetMode={setLegMode} />}
    </>
  );
}
