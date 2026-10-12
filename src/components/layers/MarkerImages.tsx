import { useMap } from 'react-map-gl/maplibre';
import { useMarkerImages } from './marker-icons';

/** Draws the marker images (all layers' icons) whenever the map asks for one it lacks. */
export default function MarkerImages() {
  useMarkerImages(useMap().current?.getMap());
  return null;
}
