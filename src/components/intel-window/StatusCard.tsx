import { type ReactNode, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import CountUp from '@/components/motion/CountUp';
import { useNextHint } from '@/hooks/next-hint.hook';
import { formatClock } from '@/lib/format';
import { formatSolveTime, intelStats, type SlotBar, unreadLabel, unreadTab } from '@/lib/intel-window';
import { EASE_OUT, LAYOUT_SPRING, SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';

const LABEL = 'text-[11px] font-extrabold tracking-[0.06em] uppercase';
const BIG = 'text-[24px] leading-none font-extrabold tracking-[-0.02em] tabular-nums';

/**
 * Right of the timeline: 2×2 tiles (next hint, hints solved, opdrachten, unread) and the oplos-tempo chart. Tiles open
 * their tab. `entrance` (read on mount): the window just opened, so the card slides in and its numbers count up.
 */
export default function StatusCard({ items, cells, entrance }: { items: IntelItem[]; cells: HintCell[]; entrance: boolean }) {
  const stats = useMemo(() => intelStats(items, cells), [items, cells]);
  const setTab = useIntelStore((state) => state.setTab);
  const from = entrance ? 0 : undefined;
  const { hints, assignments, unread } = stats;
  return (
    <motion.aside
      initial={entrance ? { opacity: 0, x: 14 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.18, ease: EASE_OUT }}
      aria-label="Status"
      className="flex w-[340px] shrink-0 flex-col gap-2.5 overflow-y-auto rounded-[24px] bg-card p-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <NextHintTile />
        <Tile label="Hints" onClick={() => setTab('hint')} sub={hints.total ? `${hints.solved} van ${hints.total} opgelost` : 'nog geen hints'}>
          {hints.percent === null ? (
            '—'
          ) : (
            <span className="flex items-center gap-2">
              <HintRing percent={hints.percent} entrance={entrance} />
              <span>
                <CountUp value={hints.percent} from={from} />%
              </span>
            </span>
          )}
        </Tile>
        <Tile label="Opdrachten" onClick={() => setTab('assignment')} sub={assignments.total ? `ingeleverd${assignments.points ? ` · ${assignments.points} pt` : ''}` : 'nog geen opdrachten'}>
          <CountUp value={assignments.submitted} from={from} />
          <span className="text-[15px] text-muted-foreground">/{assignments.total}</span>
        </Tile>
        <Tile label="Ongelezen" onClick={() => setTab(unreadTab(unread))} sub={unreadLabel(unread)}>
          <CountUp value={unread.news + unread.assignment} from={from} />
        </Tile>
      </div>
      <SolveChart slots={stats.slots} avgSolveMs={stats.avgSolveMs} entrance={entrance} />
    </motion.aside>
  );
}

/** A clickable stat tile: label, big value, sub line */
function Tile({ label, sub, onClick, children }: { label: string; sub: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer flex-col items-start gap-1.5 rounded-[18px] bg-beheer-row p-3 text-left outline-none transition-colors hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className={cn(LABEL, 'text-muted-foreground')}>{label}</span>
      <span className={BIG}>{children}</span>
      <span className="text-[11.5px] text-muted-foreground">{sub}</span>
    </button>
  );
}

/** Countdown to the next hint (orange tonal, red-ish under 5 minutes); its message swaps when the state changes */
function NextHintTile() {
  const next = useNextHint();
  const urgent = next.isUrgent || next.isNewHint;
  const mode = next.isCountdown ? 'countdown' : next.label;
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-[18px] p-3 transition-colors duration-300',
        urgent ? 'bg-destructive/15 text-destructive dark:text-red-300' : 'bg-primary-container text-orange-800 dark:text-orange-200',
      )}
    >
      <span className={LABEL}>Volgende hint</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={mode} className={cn(BIG, !next.isCountdown && 'text-[18px]')} {...SWAP}>
          {next.label}
        </motion.span>
      </AnimatePresence>
      <span className="min-h-[1lh] text-[11.5px] opacity-80">{next.nextAt ? `om ${formatClock(next.nextAt)}` : ''}</span>
    </div>
  );
}

/** Share of solved hint cells as a ring that draws to its value */
function HintRing({ percent, entrance }: { percent: number; entrance: boolean }) {
  return (
    <svg viewBox="0 0 36 36" className="size-[30px] -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r="14" fill="none" strokeWidth="5" className="stroke-beheer-row-high" />
      <motion.circle
        cx="18"
        cy="18"
        r="14"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-green-600 dark:stroke-green-400"
        initial={entrance ? { pathLength: 0 } : false}
        animate={{ pathLength: percent / 100 }}
        transition={{ duration: 0.7, delay: entrance ? 0.2 : 0, ease: EASE_OUT }}
      />
    </svg>
  );
}

/** Solved (green) over open (orange) cells per hint slot, oldest left; bars grow in on entrance and ease to new heights */
function SolveChart({ slots, avgSolveMs, entrance }: { slots: SlotBar[]; avgSolveMs: number | null; entrance: boolean }) {
  const max = Math.max(1, ...slots.map((slot) => slot.solved + slot.open));
  return (
    <div className="flex min-h-[200px] flex-1 flex-col rounded-[18px] bg-beheer-row p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(LABEL, 'text-muted-foreground')}>Oplos-tempo</span>
        <AnimatePresence mode="wait" initial={false}>
          {avgSolveMs !== null && (
            <motion.span key={formatSolveTime(avgSolveMs)} {...SWAP} className="text-[11.5px] text-muted-foreground">
              gem. {formatSolveTime(avgSolveMs)} per gebied
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {slots.length === 0 ? (
          <motion.p key="empty" {...SWAP} className="m-auto text-sm text-muted-foreground">
            Nog geen hints
          </motion.p>
        ) : (
          <motion.div key="bars" {...SWAP} className="mt-3 flex min-h-0 flex-1 gap-[7px]">
            {/* initial={false} would also block the bars' grow below; with `entrance` the slots fade in as they grow */}
            <AnimatePresence initial={entrance} mode="popLayout">
              {slots.map((slot, index) => {
                const newest = index === slots.length - 1;
                return (
                  <motion.div
                    key={slot.slotTime}
                    layout
                    transition={LAYOUT_SPRING}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    title={`${slot.hour}:00 · ${slot.solved} van ${slot.solved + slot.open} opgelost`}
                    className="flex min-w-0 flex-1 flex-col"
                  >
                    <motion.div
                      className="flex flex-1 origin-bottom flex-col justify-end gap-0.5"
                      initial={entrance ? { scaleY: 0 } : false}
                      animate={{ scaleY: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.12 + index * 0.045 }}
                    >
                      <motion.div className="rounded-[4px] bg-orange-300 dark:bg-orange-400/80" initial={false} animate={{ height: `${(slot.open / max) * 100}%` }} transition={LAYOUT_SPRING} />
                      <motion.div className="rounded-[4px] bg-green-400 dark:bg-green-500/80" initial={false} animate={{ height: `${(slot.solved / max) * 100}%` }} transition={LAYOUT_SPRING} />
                    </motion.div>
                    <span className={cn('mt-1.5 text-center text-[11px] tabular-nums', newest ? 'font-bold text-foreground' : 'text-muted-foreground')}>{slot.hour}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-2 flex gap-3.5 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-400 dark:bg-green-500/80" aria-hidden />
          opgelost
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-orange-300 dark:bg-orange-400/80" aria-hidden />
          open
        </span>
      </div>
    </div>
  );
}
