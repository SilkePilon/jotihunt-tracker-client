import { useCallback, useEffect, useRef, useState } from 'react';
import type { Geometry, Position } from 'geojson';
import type { Map as MaplibreMap, MapGeoJSONFeature, MapMouseEvent, PointLike } from 'maplibre-gl';
import { requestPopupFocus } from '@/lib/popup-focus';
import { useNightDraw } from '@/stores/night-draw.store';

export interface LayerInteractions {
  /** Click or tap on a feature of the layer; `event` gives the clicked point (e.g. to anchor a popup on a line) */
  onClick?: (feature: MapGeoJSONFeature, event: MapMouseEvent) => void;
  /** The pointer moved onto a feature of the layer (or off it: undefined) */
  onHover?: (feature: MapGeoJSONFeature | undefined) => void;
  /**
   * Open the popup of the feature with this `id` property without a click (e.g. after a sidebar list flew the map
   * there): the same popup a click opens. Return false when there is no such (visible) feature.
   */
  onOpen?: (id: string | number) => boolean;
}

type HandlersRef = { readonly current: LayerInteractions };

interface Registry {
  layers: Map<string, HandlersRef>;
  hovered?: { layer: string; id: unknown };
  /** Cursor from before the hover (e.g. the ruler's crosshair), restored afterwards */
  previousCursor?: string;
  detach: () => void;
}

const registries = new WeakMap<MaplibreMap, Registry>();

/** Extra hit radius around the pointer (px): a fingertip covers far more of the screen than a mouse pointer. */
export const TOUCH_HIT_RADIUS = 14;
export const MOUSE_HIT_RADIUS = 3;

/** The hit radius for the current primary pointer (see {@link TOUCH_HIT_RADIUS}). */
export function hitRadius(): number {
  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarse ? TOUCH_HIT_RADIUS : MOUSE_HIT_RADIUS;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Screen distance from `point` to the segment a–b. */
function segmentDistance(point: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function lineDistance(point: ScreenPoint, line: Position[], project: (position: Position) => ScreenPoint): number {
  const points = line.map(project);
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) best = Math.min(best, segmentDistance(point, points[i - 1], points[i]));
  return best;
}

/**
 * Screen distance (px) from `point` to a feature's geometry: to the point itself (a marker's anchor), or to the nearest
 * segment of a line or polygon outline. Infinity for an empty or unknown geometry.
 */
export function geometryDistance(geometry: Geometry, point: ScreenPoint, project: (position: Position) => ScreenPoint): number {
  const lines = (positions: Position[][]) => Math.min(Infinity, ...positions.filter((line) => line.length).map((line) => lineDistance(point, line, project)));
  switch (geometry.type) {
    case 'Point':
      return lines([[geometry.coordinates]]);
    case 'MultiPoint':
      return lines(geometry.coordinates.map((position) => [position]));
    case 'LineString':
      return lines([geometry.coordinates]);
    case 'MultiLineString':
    case 'Polygon':
      return lines(geometry.coordinates);
    case 'MultiPolygon':
      return lines(geometry.coordinates.flat());
    case 'GeometryCollection':
      return Math.min(Infinity, ...geometry.geometries.map((part) => geometryDistance(part, point, project)));
    default:
      return Infinity;
  }
}

/**
 * The feature closest to `point` (see {@link geometryDistance}); on a tie the earliest, i.e. the topmost of
 * queryRenderedFeatures' results.
 */
export function nearestFeature<F extends { geometry: Geometry }>(features: readonly F[], point: ScreenPoint, project: (position: Position) => ScreenPoint): F | undefined {
  let best: F | undefined;
  let bestDistance = Infinity;
  for (const feature of features) {
    const distance = geometryDistance(feature.geometry, point, project);
    if (!best || distance < bestDistance) {
      best = feature;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The feature of `layers` under `point`, with some tolerance: an exact hit wins (the topmost, like the HTML markers
 * these layers replace); otherwise the feature nearest to the point within `radius` px (a finger tap next to a
 * zoomed-out marker still opens it). Layers that aren't on the map are skipped.
 */
export function featureNear(map: MaplibreMap, point: ScreenPoint, layers: readonly string[], radius = hitRadius()): MapGeoJSONFeature | undefined {
  const mounted = layers.filter((id) => map.getLayer(id));
  if (!mounted.length) return undefined;
  try {
    const exact = map.queryRenderedFeatures([point.x, point.y] as PointLike, { layers: mounted })[0];
    if (exact || radius <= 0) return exact;
    const box: [PointLike, PointLike] = [
      [point.x - radius, point.y - radius],
      [point.x + radius, point.y + radius],
    ];
    return nearestFeature(map.queryRenderedFeatures(box, { layers: mounted }), point, (position) => map.project(position as [number, number]));
  } catch {
    // While a new style is loading
    return undefined;
  }
}

/**
 * One click and one mousemove listener per map for all marker layers: only the topmost feature under the pointer
 * reacts (like the HTML markers these layers replace, where the top element got the event), and the pointer cursor
 * is managed in one place, so moving from one layer to another doesn't leave the wrong cursor behind.
 */
function registryFor(map: MaplibreMap): Registry {
  const existing = registries.get(map);
  if (existing) return existing;

  const topFeature = (e: MapMouseEvent) => {
    // Drawing a night area: taps add corners, no marker popups or hover cursors
    if (useNightDraw.getState().active) return undefined;
    return featureNear(map, e.point, [...registry.layers.keys()]);
  };
  const setHovered = (feature: MapGeoJSONFeature | undefined) => {
    const next = feature && { layer: feature.layer.id, id: feature.properties?.id };
    const previous = registry.hovered;
    if (previous?.layer === next?.layer && previous?.id === next?.id) return;
    registry.hovered = next;
    const canvas = map.getCanvas();
    if (next && !previous) {
      registry.previousCursor = canvas.style.cursor;
      canvas.style.cursor = 'pointer';
    } else if (!next && previous) {
      canvas.style.cursor = registry.previousCursor ?? '';
    }
    if (previous) registry.layers.get(previous.layer)?.current.onHover?.(undefined);
    if (next) registry.layers.get(next.layer)?.current.onHover?.(feature);
  };
  const onClick = (e: MapMouseEvent) => {
    const feature = topFeature(e);
    if (feature) registry.layers.get(feature.layer.id)?.current.onClick?.(feature, e);
  };
  const onMove = (e: MapMouseEvent) => setHovered(topFeature(e));
  const onOut = () => setHovered(undefined);

  map.on('click', onClick);
  map.on('mousemove', onMove);
  map.on('mouseout', onOut);
  const registry: Registry = {
    layers: new Map(),
    detach: () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
      map.off('mouseout', onOut);
    },
  };
  registries.set(map, registry);
  return registry;
}

export interface OpenFeatureOptions {
  /** The popup takes focus (a keyboard activation in a list), so Tab and Escape work in it right away */
  focus?: boolean;
}

/**
 * Open a feature's popup as if it was clicked (see {@link LayerInteractions.onOpen}). False when the layer isn't
 * mounted (hidden), can't open popups from outside, or has no such feature.
 */
export function openLayerFeature(map: MaplibreMap, layerId: string, id: string | number, options: OpenFeatureOptions = {}): boolean {
  // Drawing a night area: no marker popups (like clicks)
  if (useNightDraw.getState().active) return false;
  const onOpen = registries.get(map)?.layers.get(layerId)?.current.onOpen;
  const opened = onOpen ? onOpen(id) : false;
  if (opened && options.focus) requestPopupFocus();
  return opened;
}

/** Route the map's clicks and hovers on these layers to `handlers`; returns the cleanup (see {@link useLayerInteractions}). */
export function registerLayerHandlers(map: MaplibreMap, layerIds: readonly string[], handlers: HandlersRef): () => void {
  const registry = registryFor(map);
  for (const id of layerIds) registry.layers.set(id, handlers);
  return () => {
    for (const id of layerIds) {
      if (registry.layers.get(id) === handlers) registry.layers.delete(id);
      if (registry.hovered?.layer === id) {
        registry.hovered = undefined;
        map.getCanvas().style.cursor = registry.previousCursor ?? '';
      }
    }
    if (!registry.layers.size) {
      registry.detach();
      registries.delete(map);
    }
  };
}

/**
 * Click and hover handling for canvas marker layers (see {@link registryFor}). The handlers may change on every
 * render; `layerIds` share them (e.g. a hunter's icon and its heading arrow).
 */
export function useLayerInteractions(map: MaplibreMap | undefined, layerIds: readonly string[], interactions: LayerInteractions) {
  const handlers = useRef(interactions);
  useEffect(() => {
    handlers.current = interactions;
  });

  const key = layerIds.join('\n');
  useEffect(() => (map ? registerLayerHandlers(map, key.split('\n'), handlers) : undefined), [map, key]);
}

/**
 * The feature whose popup is open. `opened` changes on every click, so clicking a feature always (re)mounts its
 * popup: the open popup closes itself on that same map click (closeOnClick), and `close` ignores that.
 */
export function usePopupSelection<T>() {
  const [active, setActive] = useState<{ id: T; opened: number }>();
  const openedCount = useRef(0);
  const selecting = useRef(false);

  const open = useCallback((id: T) => {
    selecting.current = true;
    setTimeout(() => (selecting.current = false));
    openedCount.current += 1;
    setActive({ id, opened: openedCount.current });
  }, []);
  /** For the popup's onClose */
  const close = useCallback(() => {
    if (!selecting.current) setActive(undefined);
  }, []);
  /** Close regardless of a click in progress (e.g. clicking the selected group again) */
  const dismiss = useCallback(() => setActive(undefined), []);

  return { active, open, close, dismiss };
}

/** The `id` property of a marker layer feature. */
export function featureId(feature: MapGeoJSONFeature | undefined): string | number | undefined {
  const id = feature?.properties?.id;
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
}
