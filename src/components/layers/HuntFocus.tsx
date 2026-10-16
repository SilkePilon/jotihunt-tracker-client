import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Marker } from 'react-map-gl/maplibre';
import useHuntFocusStore from '@/stores/hunt-focus.store';

/** How long the ring pulses after a log line flew the map there (the fly itself takes ~1.5 s) */
const FOCUS_MS = 4500;

/** Pulsing ring in the area colour around the hunt a Hunts-card log line flew to; fades out after a few seconds. */
export default function HuntFocus() {
  const focus = useHuntFocusStore((state) => state.focus);
  const clear = useHuntFocusStore((state) => state.clear);

  useEffect(() => {
    if (!focus) return;
    const timer = setTimeout(() => clear(focus.id), FOCUS_MS);
    return () => clearTimeout(timer);
  }, [focus, clear]);

  return (
    <AnimatePresence>
      {focus && (
        <Marker key={focus.id} longitude={focus.lng} latitude={focus.lat} anchor="center">
          <motion.span className="pointer-events-none block" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <span className="block size-16 rounded-full border-[3px] motion-safe:animate-[hq-pulse_1.6s_ease-out_infinite]" style={{ borderColor: focus.color }} />
          </motion.span>
        </Marker>
      )}
    </AnimatePresence>
  );
}
