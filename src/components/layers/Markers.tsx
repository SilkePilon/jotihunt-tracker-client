import { useEffect, useMemo, useState } from 'react';
import { Layer, Source, useMap, type CircleLayerSpecification, type LineLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { useMarkers } from '@/hooks/markers.hook';
import { useAreas } from '@/hooks/areas.hook';
import { FOX_MARKERS_LAYER, markerFeatures, trailLines } from '@/lib/map-layers';
import { filterMarkers, groupMarkersByArea, markerSplitTime } from '@/lib/markers';
import { addFoxImages, loadFoxImages, type FoxImages } from './markers/fox-images';
import { featureId, useLayerInteractions, usePopupSelection } from './map-interactions';
import MarkerPopup from './markers/MarkerPopup';
import MarkerTooltip from './markers/MarkerTooltip';

// Split between the two marker layers (static for the lifetime of the app): 23:00 on the first hunt day
const SPLIT = markerSplitTime(new Date(import.meta.env.HUNT_START_TIME));

const TRAILS_SOURCE = 'marker-trails';
const TRAILS_LAYER = 'marker-trails-line';
const TRAILS_PAINT: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': 3 };

// All foxes are one GeoJSON source + symbol layer: hundreds of HTML markers made panning stutter
const FOX_SOURCE = 'fox-markers';
const FOX_HOVER_LAYER = 'fox-markers-hover';
const FOX_LAYOUT: SymbolLayerSpecification['layout'] = { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true };
const FOX_HOVER_LAYOUT: SymbolLayerSpecification['layout'] = { ...FOX_LAYOUT, 'icon-size': 1.1 };
// Only when the icons could not be rasterised: plain dots, so the markers never disappear
const FOX_FALLBACK_PAINT: CircleLayerSpecification['paint'] = { 'circle-radius': 7, 'circle-color': '#ea580c', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' };
const FOX_INTERACTIVE_LAYERS = [FOX_MARKERS_LAYER];

interface MarkersProps {
  /** Show markers before 23:00 on the first hunt day */
  part1: boolean;
  /** Show markers from 23:00 on the first hunt day */
  part2: boolean;
}

export default function Markers({ part1, part2 }: MarkersProps) {
  const { markers, deleteMarker } = useMarkers();
  const { isVisible } = useAreas();
  const map = useMap().current?.getMap();
  const [icons, setIcons] = useState<'loading' | 'ready' | 'failed'>('loading');

  const { active, open: openPopup, close: closePopup } = usePopupSelection<string>();
  const [hoveredId, setHoveredId] = useState<string>();
  // Derived from the current data, so the popup never shows a stale copy (and closes once the marker is deleted)
  const activeMarker = active ? markers?.find((marker) => marker._id === active.id) : undefined;
  const hoveredMarker = hoveredId !== undefined && !activeMarker ? markers?.find((marker) => marker._id === hoveredId) : undefined;

  const visibleMarkers = useMemo(() => filterMarkers(markers ?? [], { part1, part2, split: SPLIT, isVisible }), [markers, part1, part2, isVisible]);
  const trails = useMemo(() => trailLines(groupMarkersByArea(visibleMarkers)), [visibleMarkers]);
  const features = useMemo(() => markerFeatures(visibleMarkers), [visibleMarkers]);
  const hoverFilter = useMemo<SymbolLayerSpecification['filter']>(() => ['==', ['get', 'id'], hoveredId ?? ''], [hoveredId]);

  // Fox icons as map images; a style switch drops them, MapLibre then asks again via styleimagemissing
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let images: FoxImages | undefined;
    const onMissing = (e: { id: string }) => {
      if (images) addFoxImages(map, images, e.id);
    };
    map.on('styleimagemissing', onMissing);
    loadFoxImages()
      .then((loaded) => {
        if (cancelled) return;
        images = loaded;
        addFoxImages(map, loaded);
        setIcons('ready');
      })
      .catch(() => !cancelled && setIcons('failed'));
    return () => {
      cancelled = true;
      map.off('styleimagemissing', onMissing);
    };
  }, [map]);

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
      <Source id={TRAILS_SOURCE} type="geojson" data={trails}>
        <Layer id={TRAILS_LAYER} type="line" source={TRAILS_SOURCE} paint={TRAILS_PAINT} />
      </Source>
      {icons !== 'loading' && (
        <Source id={FOX_SOURCE} type="geojson" data={features}>
          {icons === 'ready' ? (
            <Layer id={FOX_MARKERS_LAYER} type="symbol" source={FOX_SOURCE} layout={FOX_LAYOUT} />
          ) : (
            <Layer id={FOX_MARKERS_LAYER} type="circle" source={FOX_SOURCE} paint={FOX_FALLBACK_PAINT} />
          )}
          {icons === 'ready' && <Layer id={FOX_HOVER_LAYER} type="symbol" source={FOX_SOURCE} layout={FOX_HOVER_LAYOUT} filter={hoverFilter} />}
        </Source>
      )}
      {hoveredMarker && <MarkerTooltip marker={hoveredMarker} />}
      {activeMarker && <MarkerPopup key={active!.opened} marker={activeMarker} onClose={closePopup} deleteMarker={deleteMarker} />}
    </>
  );
}
