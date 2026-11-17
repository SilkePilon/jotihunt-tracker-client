import { AnimatePresence, motion } from 'motion/react';
import { CrosshairIcon } from 'lucide-react';
import { useDevices } from '@/hooks/devices.hook';
import { useEdition } from '@/hooks/edition.hook';
import { useNow } from '@/hooks/now.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { huntHereFix, huntHereVisible } from '@/lib/locate';
import { MAP_TILE } from '@/lib/map-chrome';
import { POP } from '@/lib/motion';
import { OWN_POSITION_FRESH_MS, OWN_POSITION_LIVE_MS, ownDeviceId, ownTrackerPosition } from '@/lib/own-position';
import { cn } from '@/lib/utils';
import { MarkerType } from '@/types/MarkerType';
import useBrowserLocationStore from '@/stores/browser-location.store';
import useFollowMeStore from '@/stores/follow-me.store';
import useMarkerDraftStore from '@/stores/marker-draft.store';
import useSidebarStore from '@/stores/sidebar.store';

/**
 * Phones: a 48px "Hunt hier" map tile right above "Mijn locatie", while that follows you (and a little while after a
 * locate). A tap opens the Hunt dialog at the own position now: the live tracker, else the browser's fix, else the spot
 * the locate found (MarkerRegistrationHost). Pops in and out; not in an archive edition or with the sheet at full height.
 */
export default function HuntHereButton() {
  const sheetSnap = useSidebarStore((state) => state.sheetSnap);
  const following = useFollowMeStore((state) => state.following);
  const located = useFollowMeStore((state) => state.located);
  const { readOnly } = useEdition();
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  // Ticks only during the grace time after following ended, to fold the tile away
  const now = useNow(!following && located !== null);
  const visible = !readOnly && sheetSnap !== 'full' && huntHereVisible(following, located, now);

  function huntHere() {
    const deviceId = ownDeviceId(devices, status?.configured ? status.uniqueId : undefined);
    const at = Date.now();
    const browser = useBrowserLocationStore.getState();
    const fix = huntHereFix(
      ownTrackerPosition(positions, deviceId, at, OWN_POSITION_LIVE_MS),
      browser.active ? browser.position : null,
      ownTrackerPosition(positions, deviceId, at, OWN_POSITION_FRESH_MS),
      useFollowMeStore.getState().located,
    );
    if (fix) useMarkerDraftStore.getState().requestOpen(MarkerType.Hunt, fix.lat, fix.lng);
  }

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.button
          key="hunt-here"
          type="button"
          aria-label="Hunt hier"
          title="Hunt hier markeren"
          onClick={huntHere}
          {...POP}
          className={cn(
            MAP_TILE,
            'pointer-events-auto grid size-12 shrink-0 place-items-center self-end rounded-2xl text-primary-text outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring active:bg-beheer-row-high [&_svg]:size-5',
          )}
        >
          <CrosshairIcon aria-hidden />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
