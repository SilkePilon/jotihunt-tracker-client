import { Marker } from 'react-map-gl/maplibre';
import type { LngLat } from '@/lib/hq-director';

/** Pulsing ring in the area colour around the fox the HQ camera looks at (rendered inside the map). */
export default function FocusPulse({ center, color }: { center: LngLat; color: string }) {
  return (
    <Marker longitude={center[0]} latitude={center[1]} anchor="center">
      <span className="pointer-events-none block size-16 rounded-full border-[3px] motion-safe:animate-[hq-pulse_2.4s_ease-out_infinite]" style={{ borderColor: color }} />
    </Marker>
  );
}
