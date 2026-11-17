import { type RefObject, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, LocateFixedIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { MapRef } from '@/components/Map';
import { useDevices } from '@/hooks/devices.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { LOCATE_ZOOM, locateMe } from '@/lib/locate';
import { MAP_TILE } from '@/lib/map-chrome';
import { POP, SWAP_TRANSITION } from '@/lib/motion';
import { ownDeviceId, ownTrackerPosition } from '@/lib/own-position';
import { cn } from '@/lib/utils';
import useHuntFocusStore from '@/stores/hunt-focus.store';
import useSidebarStore from '@/stores/sidebar.store';

/** The pulse ring at the found spot (the browser's blue location dot colour) */
const LOCATION_COLOR = '#3b82f6';

/**
 * Phones: one 48px "Mijn locatie" map button, right above the sheet (it rides in the popup dock, so an open popup
 * pushes it up). Recentres on the own tracker when fresh, else on the browser's position, and pulses a ring there.
 * Hidden while the sheet is full height.
 */
export default function MyLocationButton({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const sheetSnap = useSidebarStore((state) => state.sheetSnap);
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const [busy, setBusy] = useState(false);

  async function locate() {
    if (busy) return;
    setBusy(true);
    try {
      const tracker = ownTrackerPosition(positions, ownDeviceId(devices, status?.configured ? status.uniqueId : undefined), Date.now());
      const { lat, lng } = await locateMe(tracker);
      mapRef.current?.flyTo({ center: [lng, lat], zoom: LOCATE_ZOOM, duration: 1200, essential: true });
      useHuntFocusStore.getState().show({ lng, lat, color: LOCATION_COLOR });
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
          onClick={() => void locate()}
          {...POP}
          className={cn(
            MAP_TILE,
            'pointer-events-auto mr-[env(safe-area-inset-right)] grid size-12 shrink-0 place-items-center self-end rounded-2xl outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 active:bg-beheer-row-high [&_svg]:size-5',
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
