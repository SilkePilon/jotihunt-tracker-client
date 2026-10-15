import { useMap } from 'react-map-gl/maplibre';
import { useOrbitControls } from '@/hooks/orbit-controls.hook';

/** Calm mouse rotate/tilt around the pointer; see useOrbitControls. Renders nothing. */
export default function OrbitControls({ enabled }: { enabled: boolean }) {
  const map = useMap().current?.getMap();
  useOrbitControls(map, enabled);
  return null;
}
