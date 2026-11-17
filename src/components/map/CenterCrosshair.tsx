import { useEffect, useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { motion } from 'motion/react';
import { SWAP_TRANSITION } from '@/lib/motion';

/**
 * Keyboard drawing (night areas, the ruler): where Enter drops the next point, the middle of the map (its padded centre, like getCenter()).
 * Follows resizes and padding changes; decorative (the live region says what happens).
 */
export default function CenterCrosshair({ map, color }: { map: MaplibreMap; color: string }) {
  const [at, setAt] = useState(() => map.project(map.getCenter()));
  useEffect(() => {
    const update = () => setAt(map.project(map.getCenter()));
    map.on('move', update);
    map.on('resize', update);
    return () => {
      map.off('move', update);
      map.off('resize', update);
    };
  }, [map]);
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute z-10 size-7 -translate-x-1/2 -translate-y-1/2"
      style={{ left: at.x, top: at.y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SWAP_TRANSITION}
    >
      <svg viewBox="0 0 28 28" className="size-full overflow-visible" fill="none" strokeLinecap="round">
        {/* White halo under the line colour, so it reads on light and dark tiles */}
        <g stroke="#ffffff" strokeWidth={4.5}>
          <circle cx={14} cy={14} r={6} />
          <path d="M14 1v6M14 21v6M1 14h6M21 14h6" />
        </g>
        <g stroke={color} strokeWidth={2}>
          <circle cx={14} cy={14} r={6} />
          <path d="M14 1v6M14 21v6M1 14h6M21 14h6" />
        </g>
      </svg>
    </motion.div>
  );
}
