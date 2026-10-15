import { useRef } from 'react';
import Maplibre, { AttributionControl, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AnimatePresence, motion, useInView } from 'motion/react';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import { materialMapStyle } from '@/lib/map-style';
import { resolveStaticMapStyle } from '@/lib/map-styles';
import useSettingsStore from '@/stores/settings.store';
import type { LatLng } from '@/types/IntelChat';

/**
 * Non-interactive map in the user's map style at zoom 14 with an orange pin. The WebGL map only exists while the card is
 * near the visible part of the chat (it fades in/out), so a long chat never runs out of WebGL contexts. The worker URL
 * is set by Map.tsx, which IntelDialog already imports.
 */
export default function MiniMap({ point, label }: { point: LatLng; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { margin: '200px 0px' });
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const dark = useDarkMode();
  const style = mapStyle ? resolveStaticMapStyle(mapStyle) : materialMapStyle(dark);
  return (
    <div ref={ref} className="relative h-24 overflow-hidden bg-beheer-row-high">
      <AnimatePresence>
        {near && (
          <motion.div key="map" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <Maplibre
              initialViewState={{ longitude: point.lng, latitude: point.lat, zoom: 14 }}
              mapStyle={style}
              interactive={false}
              attributionControl={false}
              style={{ width: '100%', height: '100%' }}
              // Credits collapsed to the (i) button, as on phones
              onLoad={(event) => event.target.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')}
            >
              <AttributionControl position="top-right" compact />
              <Marker longitude={point.lng} latitude={point.lat} anchor="center">
                <span className="block size-3 rounded-full bg-primary ring-[6px] ring-primary/30" />
              </Marker>
            </Maplibre>
          </motion.div>
        )}
      </AnimatePresence>
      <span className="pointer-events-none absolute bottom-1.5 left-2 max-w-[70%] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-medium text-white">{label}</span>
    </div>
  );
}
