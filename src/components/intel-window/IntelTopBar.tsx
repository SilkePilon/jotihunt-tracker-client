import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeftIcon } from 'lucide-react';
import { INTEL_TAB_ORDER } from '@/lib/intel-window';
import { POP, POP_SPRING, SWAP_TRANSITION } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn } from '@/lib/utils';
import { SEGMENT_THUMB } from '@/components/beheer/controls/Segmented';
import useIntelStore from '@/stores/intel.store';
import type { IntelTab } from '@/types/Intel';

const LABELS: Record<IntelTab, string> = { all: 'Alles', hint: 'Hints', assignment: 'Opdrachten', news: 'Nieuws' };

/**
 * Back button (only on an item; grows in from zero width), "Intel" and the tabs (a dot on Nieuws / Opdrachten while one
 * of those is unread). 64px high so it centres on the dialog's close button; leaves room right for it.
 */
export default function IntelTopBar({ unread, detail, onBack }: { unread: Partial<Record<IntelTab, boolean>>; detail: boolean; onBack: () => void }) {
  const tab = useIntelStore((state) => state.tab);
  const setTab = useIntelStore((state) => state.setTab);
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 pr-16 pl-4">
      <motion.button
        type="button"
        onClick={onBack}
        title="Terug naar de tijdlijn (Esc)"
        aria-label="Terug naar de tijdlijn"
        // Collapsed on the timeline: out of the tab order and the accessibility tree, and focus can't stay on it
        inert={!detail}
        initial={false}
        animate={detail ? { width: 34, marginRight: 0, opacity: 1 } : { width: 0, marginRight: -12, opacity: 0 }}
        transition={SWAP_TRANSITION}
        className="grid h-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl bg-beheer-row-high text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <ArrowLeftIcon className="size-4" />
      </motion.button>
      <h2 className="text-lg font-bold">Intel</h2>
      {/* A filter over one timeline (no separate panels): toggle buttons, not a tablist. Looks like beheer/controls/Segmented
          (track, SEGMENT_THUMB, spring); isolate keeps the 44px touch areas above the track */}
      <div role="group" aria-label="Soort" className="isolate flex gap-0.5 rounded-lg bg-beheer-row p-[3px]">
        {INTEL_TAB_ORDER.map((value) => {
          const active = value === tab;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(value)}
              className={cn(
                COARSE_HIT_AREA,
                'flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span layoutId="intel-tab" className={cn('absolute inset-0 rounded-[9px]', SEGMENT_THUMB)} transition={POP_SPRING} />
              )}
              <span className="relative">{LABELS[value]}</span>
              <AnimatePresence>{unread[value] && <motion.span key="dot" {...POP} aria-hidden className="relative size-[7px] rounded-full bg-primary-text dark:bg-primary" />}</AnimatePresence>
              {unread[value] && <span className="sr-only">, ongelezen</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
