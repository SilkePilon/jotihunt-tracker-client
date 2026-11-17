import { type RefObject, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, LocateFixedIcon, NavigationIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { MapRef } from '@/components/Map';
import { useDevices } from '@/hooks/devices.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { LOCATE_ZOOM, geolocationGranted, locateMe } from '@/lib/locate';
import { MAP_TILE, MAP_LOCATION_COLOR } from '@/lib/map-chrome';
import { POP, SWAP_TRANSITION } from '@/lib/motion';
import { OWN_POSITION_FRESH_MS, OWN_POSITION_LIVE_MS, ownDeviceId, ownTrackerPosition } from '@/lib/own-position';
import { cn } from '@/lib/utils';
import useBrowserLocationStore from '@/stores/browser-location.store';
import useFollowMeStore from '@/stores/follow-me.store';
import useHuntFocusStore from '@/stores/hunt-focus.store';
import useSidebarStore from '@/stores/sidebar.store';


/**
 * Phones: one 48px "Mijn locatie" map button, right above the sheet (it rides in the popup dock, so an open popup
 * pushes it up). A tap centres on the own tracker when its fix is under 20 s old, else on the browser's position
 * (already granted; a tracker fix under 150 s beats a permission prompt), pulses a ring there and
 * then follows you (FollowMe) until the map is moved by hand or the button is tapped again; a browser position also
 * leaves a small own-position dot that follows you (BrowserLocationDot). Hidden while the sheet is full height.
 */
export default function MyLocationButton({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const sheetSnap = useSidebarStore((state) => state.sheetSnap);
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const [busy, setBusy] = useState(false);
  // On while the map follows the own position (like the desktop geolocate tile's tracking mode)
  const following = useFollowMeStore((state) => state.following);

  async function locate() {
    if (busy) return;
    // Second tap: stop following, the map stays where it is
    if (following) {
      useFollowMeStore.getState().stop();
      return;
    }
    setBusy(true);
    try {
      const deviceId = ownDeviceId(devices, status?.configured ? status.uniqueId : undefined);
      const now = Date.now();
      const { lat, lng, accuracy, source } = await locateMe({
        live: ownTrackerPosition(positions, deviceId, now, OWN_POSITION_LIVE_MS),
        recent: ownTrackerPosition(positions, deviceId, now, OWN_POSITION_FRESH_MS),
        granted: await geolocationGranted(),
      });
      // Found by the browser: a dot stays there and follows you (BrowserLocationDot; it gives way to a live own marker)
      if (source === 'browser') useBrowserLocationStore.getState().start({ lat, lng }, accuracy);
      // Never zoom out when the hunter is already closer in; reduced motion turns the flight into a jump (no `essential`)
      mapRef.current?.flyTo({ center: [lng, lat], zoom: Math.max(LOCATE_ZOOM, mapRef.current.getZoom() ?? 0), duration: 1200 });
      // After the flight call: any other camera move through the map ref ends following
      useFollowMeStore.getState().start();
      // "Hunt hier" (above this button) registers here
      useFollowMeStore.getState().setLocated({ lat, lng, at: Date.now() });
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
          title={following ? 'Mijn locatie volgen stoppen' : 'Mijn locatie'}
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
            <motion.span key={busy ? 'busy' : following ? 'follow' : 'idle'} className="grid" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SWAP_TRANSITION}>
              {/* Following: the filled arrow of a navigation app */}
              {busy ? <Loader2Icon className="animate-spin" /> : following ? <NavigationIcon className="fill-current" /> : <LocateFixedIcon />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
