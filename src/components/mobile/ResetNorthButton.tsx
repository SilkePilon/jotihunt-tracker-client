import type { RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CompassIcon } from 'lucide-react';
import type { MapRef } from '@/components/Map';
import { RESET_NORTH_LABEL } from '@/lib/reset-north';
import { MAP_TILE } from '@/lib/map-chrome';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useMapRotationStore from '@/stores/map-rotation.store';
import useSidebarStore from '@/stores/sidebar.store';

/**
 * Phones: a 48px compass tile above "Mijn locatie" while the map is turned or tilted (a two-finger twist is easy to do
 * by accident and hard to undo exactly); a tap puts it back to north-up and flat. Hidden while the sheet is full height.
 */
export default function ResetNorthButton({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const sheetSnap = useSidebarStore((state) => state.sheetSnap);
  const rotated = useMapRotationStore((state) => state.rotated);

  return (
    <AnimatePresence initial={false}>
      {rotated && sheetSnap !== 'full' && (
        <motion.button
          key="north"
          type="button"
          aria-label={RESET_NORTH_LABEL}
          title={RESET_NORTH_LABEL}
          onClick={(event) => mapRef.current?.resetNorth(event.currentTarget)}
          {...POP}
          className={cn(
            MAP_TILE,
            'pointer-events-auto grid size-12 shrink-0 place-items-center self-end rounded-2xl outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring active:bg-beheer-row-high [&_svg]:size-5',
          )}
        >
          <CompassIcon />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
