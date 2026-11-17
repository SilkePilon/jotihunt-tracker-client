import { useEffect } from 'react';
import { AnimatePresence, motion, usePresence } from 'motion/react';
import { Marker } from 'react-map-gl/maplibre';
import { useDevices } from '@/hooks/devices.hook';
import { AGE_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { MAP_LOCATION_COLOR } from '@/lib/map-chrome';
import { POP } from '@/lib/motion';
import { ownDeviceId, ownTrackerPosition } from '@/lib/own-position';
import useBrowserLocationStore from '@/stores/browser-location.store';

/** The dot itself: pops in, and pops out before its Marker goes (a Marker has no exit phase of its own). */
function Dot({ lng, lat }: { lng: number; lat: number }) {
  const [isPresent, safeToRemove] = usePresence();
  return (
    <Marker longitude={lng} latitude={lat} anchor="center" style={{ pointerEvents: 'none' }}>
      <motion.span
        aria-hidden
        className="relative block size-3.5 rounded-full shadow-[0_0_0_2px_#fff,0_1px_4px_rgb(0_0_0/0.3)]"
        style={{ backgroundColor: MAP_LOCATION_COLOR }}
        initial={POP.initial}
        animate={isPresent ? POP.animate : POP.exit}
        transition={isPresent ? POP.transition : POP.exit.transition}
        onAnimationComplete={() => {
          if (!isPresent) safeToRemove?.();
        }}
      >
        {/* Pulse ring; none under reduced motion */}
        <span className="absolute -inset-0.5 -z-10 rounded-full motion-safe:animate-[jh-marker-pulse_1.6s_ease-out_infinite] motion-reduce:hidden" style={{ backgroundColor: MAP_LOCATION_COLOR }} />
      </motion.span>
    </Marker>
  );
}

/**
 * Phones: after "Mijn locatie" found the browser's position, a small own-position dot that follows it
 * (watchPosition) until the page is hidden or the own tracker is live (its hunter marker shows where we are then).
 */
export default function BrowserLocationDot() {
  const { active, position, setPosition, stop } = useBrowserLocationStore();
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const now = useNow(active, AGE_CLOCK_TICK_MS);
  const trackerLive = !!ownTrackerPosition(positions, ownDeviceId(devices, status?.configured ? status.uniqueId : undefined), now);
  const watching = active && !trackerLive;

  useEffect(() => {
    if (active && trackerLive) stop();
  }, [active, trackerLive, stop]);

  useEffect(() => {
    if (!watching || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (fix) => setPosition({ lat: fix.coords.latitude, lng: fix.coords.longitude }),
      // A failed fix keeps the last dot; a denied permission ends it
      (error) => {
        if (error.code === error.PERMISSION_DENIED) stop();
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      navigator.geolocation.clearWatch(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [watching, setPosition, stop]);

  return <AnimatePresence>{watching && position && <Dot key="dot" lng={position.lng} lat={position.lat} />}</AnimatePresence>;
}
