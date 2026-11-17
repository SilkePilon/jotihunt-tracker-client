import type { RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MinusIcon, PlusIcon } from 'lucide-react';
import type { MapRef } from '@/components/Map';
import { MAP_TILE } from '@/lib/map-chrome';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useSidebarStore from '@/stores/sidebar.store';

const TILE = cn(
  MAP_TILE,
  'grid size-12 place-items-center outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring active:bg-beheer-row-high [&_svg]:size-5',
);

/**
 * Phones: 48px zoom + and − tiles as one segmented pair (2px seam, like the desktop zoom stack), above "Mijn locatie":
 * pinching is awkward one-handed, with gloves or while walking. Hidden while the sheet is full height.
 */
export default function ZoomButtons({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const sheetSnap = useSidebarStore((state) => state.sheetSnap);

  return (
    <AnimatePresence initial={false}>
      {sheetSnap !== 'full' && (
        <motion.div key="zoom" {...POP} className="pointer-events-auto flex shrink-0 flex-col gap-0.5 self-end">
          <button type="button" aria-label="Inzoomen" title="Inzoomen" onClick={() => mapRef.current?.zoomBy(1)} className={cn(TILE, 'rounded-t-2xl rounded-b-[4px]')}>
            <PlusIcon />
          </button>
          <button type="button" aria-label="Uitzoomen" title="Uitzoomen" onClick={() => mapRef.current?.zoomBy(-1)} className={cn(TILE, 'rounded-t-[4px] rounded-b-2xl')}>
            <MinusIcon />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
