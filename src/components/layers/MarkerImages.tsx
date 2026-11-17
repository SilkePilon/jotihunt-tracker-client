import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { LABEL_SCALE_VAR, labelScale, MARKER_SCALE_VAR, zoomScale } from '@/lib/zoom-scale';
import { useMarkerImages } from './marker-icons';

/**
 * Keeps the zoom scale of the HTML markers in CSS variables on the map container (one listener for all of them, no
 * re-renders): markers use `scale: var(--map-marker-scale, 1)`, or the label variable when they carry text.
 */
function useMarkerZoomScale(map: MaplibreMap | undefined) {
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    let last = '';
    const update = () => {
      const zoom = map.getZoom();
      const marker = zoomScale(zoom).toFixed(3);
      if (marker === last) return;
      last = marker;
      container.style.setProperty(MARKER_SCALE_VAR, marker);
      container.style.setProperty(LABEL_SCALE_VAR, labelScale(zoom).toFixed(3));
    };
    update();
    map.on('zoom', update);
    return () => {
      map.off('zoom', update);
      container.style.removeProperty(MARKER_SCALE_VAR);
      container.style.removeProperty(LABEL_SCALE_VAR);
    };
  }, [map]);
}

/** Draws the marker images (all layers' icons) whenever the map asks for one it lacks, and scales the HTML markers with the zoom. */
export default function MarkerImages() {
  const map = useMap().current?.getMap();
  useMarkerImages(map);
  useMarkerZoomScale(map);
  return null;
}
