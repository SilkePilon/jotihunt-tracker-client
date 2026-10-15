import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Source, useMap, type FillExtrusionLayerSpecification } from 'react-map-gl/maplibre';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import {
  BUILDINGS_ATTRIBUTION,
  BUILDINGS_FADE_MS,
  BUILDINGS_LAYER,
  BUILDINGS_OPACITY,
  BUILDINGS_SOURCE,
  BUILDINGS_TILE_LAYER,
  BUILDINGS_TILT,
  BUILDINGS_ZOOM,
  buildingColor,
  buildingsTileUrl,
  firstSymbolLayerId,
  FLAT_PITCH,
} from '@/lib/buildings';
import useSettingsStore from '@/stores/settings.store';

const TILES = [buildingsTileUrl(import.meta.env.API_BASE_URL)];
const CAMERA_MS = 600;

/**
 * The "3D-gebouwen" layer: 3DBAG buildings extruded to their height. Turning it on fades the buildings in and tilts a
 * flat map; turning it off fades them out, then removes the source and tilts back (only if the toggle tilted it).
 */
export default function Buildings3D({ visible }: { visible: boolean }) {
  const map = useMap().current?.getMap();
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const dark = useDarkMode();
  // Stays mounted for the fade-out after `visible` turns false
  const [mounted, setMounted] = useState(visible);
  // Opacity target: 0 on the first frame after mounting, so MapLibre transitions it up
  const [shown, setShown] = useState(false);
  const [beforeId, setBeforeId] = useState<string>();
  if (visible && !mounted) setMounted(true);

  // Whether the toggle (not the user) tilted the map; only then does turning the layer off tilt it back
  const tilted = useRef(false);
  // Starts as `visible`: a layer that is already on at mount (persisted setting, reload, HQ wall) doesn't tilt
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (visible) {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    // Fade out (opacity follows `visible` too), then unmount and reset, so the next mount fades in from 0 again; then
    // tilt back if the toggle tilted the map
    const timer = setTimeout(() => {
      setMounted(false);
      setShown(false);
      if (map && tilted.current) map.easeTo({ pitch: 0, duration: CAMERA_MS });
      tilted.current = false;
    }, BUILDINGS_FADE_MS);
    return () => clearTimeout(timer);
  }, [visible, map]);

  // Tilt a flat map on an actual off -> on toggle
  useEffect(() => {
    if (!map) return;
    if (visible && !wasVisible.current && map.getPitch() < FLAT_PITCH) {
      tilted.current = true;
      map.easeTo({ pitch: BUILDINGS_TILT, duration: CAMERA_MS });
    }
    wasVisible.current = visible;
  }, [visible, map]);

  // The user pitching the map by hand takes over the camera: don't force it back to flat on toggle off
  useEffect(() => {
    if (!map) return;
    const onPitch = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) tilted.current = false;
    };
    map.on('pitchstart', onPitch);
    return () => {
      map.off('pitchstart', onPitch);
    };
  }, [map]);

  // Below the current style's labels; recomputed on every style switch
  useEffect(() => {
    if (!map) return;
    const update = () => setBeforeId(firstSymbolLayerId(map.getStyle()?.layers ?? []));
    map.on('styledata', update);
    update();
    return () => {
      map.off('styledata', update);
    };
  }, [map]);

  const paint = useMemo<FillExtrusionLayerSpecification['paint']>(
    () => ({
      'fill-extrusion-color': buildingColor(mapStyle, dark),
      'fill-extrusion-height': ['get', 'h'],
      'fill-extrusion-base': 0,
      'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-opacity': shown && visible ? BUILDINGS_OPACITY : 0,
      'fill-extrusion-opacity-transition': { duration: BUILDINGS_FADE_MS, delay: 0 },
    }),
    [mapStyle, dark, shown, visible],
  );

  if (!mounted) return null;

  return (
    <Source id={BUILDINGS_SOURCE} type="vector" tiles={TILES} minzoom={BUILDINGS_ZOOM} maxzoom={BUILDINGS_ZOOM} attribution={BUILDINGS_ATTRIBUTION}>
      <Layer id={BUILDINGS_LAYER} type="fill-extrusion" source-layer={BUILDINGS_TILE_LAYER} minzoom={BUILDINGS_ZOOM} beforeId={beforeId} paint={paint} />
    </Source>
  );
}
