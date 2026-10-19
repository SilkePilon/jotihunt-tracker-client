import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MaplibreMap, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';

export interface LayerInteractions {
  /** Click or tap on a feature of the layer; `event` gives the clicked point (e.g. to anchor a popup on a line) */
  onClick?: (feature: MapGeoJSONFeature, event: MapMouseEvent) => void;
  /** The pointer moved onto a feature of the layer (or off it: undefined) */
  onHover?: (feature: MapGeoJSONFeature | undefined) => void;
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

/**
 * One click and one mousemove listener per map for all marker layers: only the topmost feature under the pointer
 * reacts (like the HTML markers these layers replace, where the top element got the event), and the pointer cursor
 * is managed in one place, so moving from one layer to another doesn't leave the wrong cursor behind.
 */
function registryFor(map: MaplibreMap): Registry {
  const existing = registries.get(map);
  if (existing) return existing;

  const topFeature = (e: MapMouseEvent) => {
    const layers = [...registry.layers.keys()].filter((id) => map.getLayer(id));
    if (!layers.length) return undefined;
    try {
      return map.queryRenderedFeatures(e.point, { layers })[0];
    } catch {
      // While a new style is loading
      return undefined;
    }
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
  useEffect(() => {
    if (!map) return;
    const ids = key.split('\n');
    const registry = registryFor(map);
    for (const id of ids) registry.layers.set(id, handlers);
    return () => {
      for (const id of ids) {
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
  }, [map, key]);
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
