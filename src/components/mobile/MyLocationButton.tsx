import { type RefObject, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, LocateFixedIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { MapRef } from '@/components/Map';
import { useDevices } from '@/hooks/devices.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { LOCATE_ZOOM, locateMe } from '@/lib/locate';
import { MAP_TILE, MAP_LOCATION_COLOR } from '@/lib/map-chrome';
import { POP, SWAP_TRANSITION } from '@/lib/motion';
import { OWN_POSITION_FRESH_MS, ownDeviceId, ownTrackerPosition } from '@/lib/own-position';
import { cn } from '@/lib/utils';
import useBrowserLocationStore from '@/stores/browser-location.store';
import useHuntFocusStore from '@/stores/hunt-focus.store';
import useSidebarStore from '@/stores/sidebar.store';


/**
 * Phones: one 48px "Mijn locatie" map button, right above the sheet (it rides in the popup dock, so an open popup
 * pushes it up). Recentres on the own tracker when fresh, else on the browser's position, and pulses a ring there; a
 * browser position also leaves a small own-position dot that follows you (BrowserLocationDot).
 * Hidden while the sheet is full height.
 */
export default function MyLocationButton({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const sheetSnap = useSidebarStore((state) => state.sheetSnap);
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const [busy, setBusy] = useState(false);
  // On while the own-position dot follows the browser's location (like the desktop geolocate tile)
  const following = useBrowserLocationStore((state) => state.active);

  async function locate() {
    if (busy) return;
    setBusy(true);
    try {
      const tracker = ownTrackerPosition(positions, ownDeviceId(devices, status?.configured ? status.uniqueId : undefined), Date.now(), OWN_POSITION_FRESH_MS);
      const { lat, lng, accuracy } = await locateMe(tracker);
      // Found by the browser (no live own tracker): a dot stays there and follows you (BrowserLocationDot)
      if (!tracker) useBrowserLocationStore.getState().start({ lat, lng }, accuracy);
      // Never zoom out when the hunter is already closer in; reduced motion turns the flight into a jump (no `essential`)
      mapRef.current?.flyTo({ center: [lng, lat], zoom: Math.max(LOCATE_ZOOM, mapRef.current.getZoom() ?? 0), duration: 1200 });
      useHuntFocusStore.getState().show({ lng, lat, color: MAP_LOCATION_COLOR });
    } catch (error) {
      toast.error('Locatie niet gevonden', { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence initial={false}>
      {sheetSnap !== 'full' && (
        <motion.button
          key="locate"
          type="button"
          aria-label="Mijn locatie"
          title="Mijn locatie"
          aria-busy={busy}
          aria-pressed={following}
          onClick={() => void locate()}
          {...POP}
          className={cn(
            MAP_TILE,
            'pointer-events-auto grid size-12 shrink-0 place-items-center self-end rounded-2xl outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring [&_svg]:size-5',
            following
              ? 'bg-primary-container text-on-primary-container active:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))]'
              : 'active:bg-beheer-row-high',
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={busy ? 'busy' : 'idle'} className="grid" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SWAP_TRANSITION}>
              {busy ? <Loader2Icon className="animate-spin" /> : <LocateFixedIcon />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
