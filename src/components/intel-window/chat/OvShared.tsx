import { BusIcon, ShipIcon, TrainFrontIcon, TrainTrackIcon, TramFrontIcon, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { OvMode } from '@/types/IntelChat';

const MODE_ICON: Record<OvMode, LucideIcon> = { BUS: BusIcon, TRAM: TramFrontIcon, METRO: TrainTrackIcon, BOAT: ShipIcon, TRAIN: TrainFrontIcon };
const MODE_NAME: Record<OvMode, string> = { BUS: 'Bus', TRAM: 'Tram', METRO: 'Metro', BOAT: 'Boot', TRAIN: 'Trein' };

/** Lucide icon of a transport mode (bus for a mode this client doesn't know) */
export function ModeIcon({ mode, className }: { mode: OvMode; className?: string }) {
  const Icon = MODE_ICON[mode] ?? BusIcon;
  return <Icon role="img" aria-label={MODE_NAME[mode] ?? mode} className={cn('size-3.5 shrink-0 text-muted-foreground', className)} />;
}

/** Line number as a small tonal chip */
export function LineChip({ line }: { line: string }) {
  return <span className="inline-flex min-w-7 shrink-0 justify-center rounded-md bg-fox-ok-container px-1.5 py-px text-label leading-4 font-extrabold text-fox-on-ok tabular-nums">{line}</span>;
}

/**
 * Small text toggle under a list; its label swaps ("Toon alle 12" ↔ "Minder"). Phones get a 44px touch area
 * (COARSE_HIT_AREA): give its parent `isolate`. That area reaches 14px below the 16px line; the cards' 10px bottom
 * padding plus a 4px margin on touch screens keeps it inside their `overflow-hidden` when the toggle is last.
 */
export function MoreToggle({ open, onToggle, more, less = 'Minder' }: { open: boolean; onToggle: () => void; more: string; less?: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(COARSE_HIT_AREA, 'self-start rounded-md pointer-coarse:mb-1 text-xs font-semibold text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring')}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={open ? 'less' : 'more'} className="block" {...SWAP}>
          {open ? less : more}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
