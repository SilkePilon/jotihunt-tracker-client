import { motion } from 'motion/react';
import { MapIcon, RotateCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAP_TILE } from '@/lib/map-chrome';
import { SWAP } from '@/lib/motion';
import { TONAL_BUTTON } from '@/lib/tonal-button';
import { cn } from '@/lib/utils';

/**
 * Over the map when its style or tiles could not be loaded (offline cold start, tile server down). Compact and
 * centred; the rest of the app keeps working underneath. Use inside AnimatePresence.
 */
export default function MapUnavailableCard({ className }: { className?: string }) {
  return (
    <motion.div
      role="alert"
      className={cn(MAP_TILE, 'pointer-events-auto flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-3', className)}
      {...SWAP}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-beheer-row-high text-muted-foreground">
        <MapIcon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight">Kaart niet beschikbaar</p>
        <p className="text-[12.5px] text-muted-foreground">Controleer je verbinding.</p>
      </div>
      {/* The map can't re-fetch a style (TileJSON) that failed at start; a reload can */}
      <Button variant="ghost" className={cn(TONAL_BUTTON, 'shrink-0 px-3')} onClick={() => window.location.reload()}>
        <RotateCwIcon />
        Opnieuw
      </Button>
    </motion.div>
  );
}
