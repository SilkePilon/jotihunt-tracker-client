import { BusIcon, ShipIcon, TrainFrontIcon, TrainTrackIcon, TramFrontIcon, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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
  return <span className="inline-flex min-w-7 shrink-0 justify-center rounded-md bg-fox-ok-container px-1.5 py-px text-[11px] leading-4 font-extrabold text-fox-on-ok tabular-nums">{line}</span>;
}

/** Small text toggle under a list; its label swaps ("Toon alle 12" ↔ "Minder") */
export function MoreToggle({ open, onToggle, more, less = 'Minder' }: { open: boolean; onToggle: () => void; more: string; less?: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="self-start rounded-md text-[12px] font-semibold text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={open ? 'less' : 'more'} className="block" {...SWAP}>
          {open ? less : more}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
