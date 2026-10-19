import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layer, Source, useMap, type LineLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import type { ExpressionSpecification } from 'maplibre-gl';
import { useMarkers } from '@/hooks/markers.hook';
import { useAreas } from '@/hooks/areas.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useTrails } from '@/hooks/trails.hook';
import { FOX_MARKERS_LAYER, markerFeatures, trailLines } from '@/lib/map-layers';
import { filterMarkers, groupMarkersByArea, markerSplitTime } from '@/lib/markers';
import { areaKey, HINT_LABEL_MS, hintNumbering, themedIconExpression, type MarkerTheme } from '@/lib/marker-style';
import { MarkerType } from '@/types/MarkerType';
import { HINT_ANCHOR_OFFSET, useMarkerTheme } from './marker-icons';
import { featureId, useLayerInteractions, usePopupSelection } from './map-interactions';
import MarkerPopup from './markers/MarkerPopup';
import MarkerTooltip from './markers/MarkerTooltip';
import TrailLayers from './trails/TrailLayers';

// Longest timer the browser accepts (about 24.8 days)
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

const TRAILS_SOURCE = 'marker-trails';
const TRAILS_LAYER = 'marker-trails-line';
const TRAILS_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 3 };

// All foxes are one GeoJSON source + symbol layer: hundreds of HTML markers made panning stutter. Spots, hunts and
// unknown types are centred on their point; hint labels hang above it with their anchor dot on the point.
const FOX_SOURCE = 'fox-markers';
const FOX_HOVER_LAYER = 'fox-markers-hover';
// Null-safe: features without the property count as no hint
const IS_HINT: ExpressionSpecification = ['==', ['get', 'hint'], true];
function foxLayout(theme: MarkerTheme): SymbolLayerSpecification['layout'] {
  return {
    'icon-image': themedIconExpression(theme),
    'icon-anchor': ['case', IS_HINT, 'bottom-left', 'center'],
    'icon-offset': ['case', IS_HINT, ['literal', HINT_ANCHOR_OFFSET], ['literal', [0, 0]]],
    // Hint labels above the fox markers, like the Android app's separate hint layer
    'symbol-sort-key': ['case', IS_HINT, 1, 0],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  };
}
const FOX_INTERACTIVE_LAYERS = [FOX_MARKERS_LAYER];

interface MarkersProps {
  /** Show markers before 23:00 on the first hunt day */
  part1: boolean;
  /** Show markers from 23:00 on the first hunt day */
  part2: boolean;
}

export default function Markers({ part1, part2 }: MarkersProps) {
  const { markers, deleteMarker } = useMarkers();
  const { areas, isVisible } = useAreas();
  const { board } = useHintBoard();
  const { isForbidden } = useHuntableAreas();
  const map = useMap().current?.getMap();
  const theme = useMarkerTheme();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { huntStart, huntEnd } = useAppConfig();
  // Split between the two marker layers: 23:00 on the first hunt day (none while the hunt start is unset)
  const split = useMemo(() => (huntStart ? markerSplitTime(new Date(huntStart)) : undefined), [huntStart]);
  // Hint numbers count the hints inside the hunt
  const hunt = useMemo(() => ({ startMs: huntStart ? Date.parse(huntStart) : NaN, endMs: huntEnd ? Date.parse(huntEnd) : NaN }), [huntStart, huntEnd]);

  const { active, open: openPopup, close: closePopup } = usePopupSelection<string>();
  const [hoveredId, setHoveredId] = useState<string>();
  // Derived from the current data, so the popup never shows a stale copy (and closes once the marker is deleted)
  const activeMarker = active ? markers?.find((marker) => marker._id === active.id) : undefined;
  const hoveredMarker = hoveredId !== undefined && !activeMarker ? markers?.find((marker) => marker._id === hoveredId) : undefined;

  const visibleMarkers = useMemo(() => filterMarkers(markers ?? [], { part1, part2, split, isVisible }), [markers, part1, part2, split, isVisible]);
  // Routed legs from the server when routes are on; otherwise (or until they load) the straight trail per area
  const { data: routed } = useTrails();
  const routesOn = routed?.enabled === true;
  const visibleIds = useMemo(() => new Set(visibleMarkers.flatMap((marker) => (marker._id ? [marker._id] : []))), [visibleMarkers]);
  const trails = useMemo(() => trailLines(groupMarkersByArea(visibleMarkers)), [visibleMarkers]);
  const statusByArea = useMemo(() => new Map((areas ?? []).map((area) => [areaKey(area.name), area.status])), [areas]);
  const statusOf = useCallback((area: string) => statusByArea.get(areaKey(area)), [statusByArea]);
  const numbering = useMemo(() => hintNumbering(board, hunt), [board, hunt]);
  const features = useMemo(() => markerFeatures(visibleMarkers, { statusOf, numbering, nowMs, isForbidden }), [visibleMarkers, statusOf, numbering, nowMs, isForbidden]);
  const layout = useMemo(() => foxLayout(theme), [theme]);
  const hoverLayout = useMemo<SymbolLayerSpecification['layout']>(() => ({ ...layout, 'icon-size': 1.1 }), [layout]);
  const hoverFilter = useMemo<SymbolLayerSpecification['filter']>(() => ['==', ['get', 'id'], hoveredId ?? ''], [hoveredId]);

  // Hint labels turn into dots after six hours: rebuild the features only when the next one does (not every minute)
  useEffect(() => {
    const flips = visibleMarkers.filter((marker) => marker.type === MarkerType.Hint).map((marker) => new Date(marker.time).getTime() + HINT_LABEL_MS + 1).filter((ms) => ms > nowMs);
    if (!flips.length) return;
    const timeout = setTimeout(() => setNowMs(Date.now()), Math.min(MAX_TIMEOUT_MS, Math.min(...flips) - Date.now()));
    return () => clearTimeout(timeout);
  }, [visibleMarkers, nowMs]);

  // Click → popup, hover → pointer cursor + tooltip + slightly larger icon
  useLayerInteractions(map, FOX_INTERACTIVE_LAYERS, {
    onClick: (feature) => {
      const id = featureId(feature);
      if (typeof id !== 'string') return;
      openPopup(id);
      // Like the old tooltips: forget the hover, it comes back on the next mouse move
      setHoveredId(undefined);
    },
    onHover: (feature) => {
      const id = featureId(feature);
      setHoveredId(typeof id === 'string' ? id : undefined);
    },
  });

  return (
    <>
      {routesOn ? (
        <TrailLayers visibleIds={visibleIds} />
      ) : (
        <Source id={TRAILS_SOURCE} type="geojson" data={trails}>
          <Layer id={TRAILS_LAYER} type="line" source={TRAILS_SOURCE} paint={TRAILS_PAINT} />
        </Source>
      )}
      <Source id={FOX_SOURCE} type="geojson" data={features}>
        <Layer id={FOX_MARKERS_LAYER} type="symbol" source={FOX_SOURCE} layout={layout} />
        <Layer id={FOX_HOVER_LAYER} type="symbol" source={FOX_SOURCE} layout={hoverLayout} filter={hoverFilter} />
      </Source>
      {hoveredMarker && <MarkerTooltip marker={hoveredMarker} />}
      {activeMarker && <MarkerPopup key={active!.opened} marker={activeMarker} onClose={closePopup} deleteMarker={deleteMarker} />}
    </>
  );
}
