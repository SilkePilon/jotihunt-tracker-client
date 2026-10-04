import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { layerStackMoves, MAP_LAYER_STACK } from '@/lib/map-layers';

/**
 * Keeps the app's layers stacked as in MAP_LAYER_STACK (foxes, then groups, then hunters on top). Layers are added
 * as they mount (toggling a layer, icons that finish loading later, a style switch), so the order is fixed up after
 * every style change.
 */
export default function LayerStack() {
  const map = useMap().current?.getMap();

  useEffect(() => {
    if (!map) return;
    const restack = () => {
      for (const [id, beforeId] of layerStackMoves(map.getLayersOrder(), MAP_LAYER_STACK)) map.moveLayer(id, beforeId);
    };
    map.on('styledata', restack);
    restack();
    return () => {
      map.off('styledata', restack);
    };
  }, [map]);

  return null;
}
