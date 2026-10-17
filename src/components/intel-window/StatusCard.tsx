import { type ReactNode, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import CountUp from '@/components/motion/CountUp';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useNextHint } from '@/hooks/next-hint.hook';
import { formatClock } from '@/lib/format';
import { type ChartColumn, chartColumns, formatSolveTime, intelStats, type SlotBar, unreadLabel, unreadTab } from '@/lib/intel-window';
import { EASE_OUT, LAYOUT_SPRING, SWAP } from '@/lib/motion';

import { areaOptions, cn } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';

/** A bar swapping between expected (dashed) and published */
const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.22 } };

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
        <Tile label="Opdrachten" onClick={() => setTab('assignment')} sub={assignments.total ? `ingeleverd${assignments.judged ? ` · ${assignments.points} pt verdiend` : ''}` : 'nog geen opdrachten'}>
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
        // At 0% the round cap would still paint a dot
        animate={{ pathLength: percent / 100, opacity: percent > 0 ? 1 : 0 }}
        transition={{ duration: 0.7, delay: entrance ? 0.2 : 0, ease: EASE_OUT }}
      />
    </svg>
  );
}

const AREA_COUNT = areaOptions.length;

/**
 * Solved (green) over open (orange) cells per hint slot, oldest left, on a fixed scale of all areas (bars max 24px wide,
 * so one hint is never one big block). Expected slots fill the rest as dashed outlines; the next one in orange. Bars
 * grow in on entrance and ease to new heights.
 */
function SolveChart({ slots, avgSolveMs, entrance }: { slots: SlotBar[]; avgSolveMs: number | null; entrance: boolean }) {
  const { nextAt } = useNextHint();
  const nextMs = nextAt?.getTime() ?? null;
  const { huntEnd } = useAppConfig();
  // The last hint slot of the hunt (as in useNextHint): nothing is expected after it (no limit while the end is unset)
  const lastSlotMs = huntEnd ? new Date(huntEnd).getTime() - 60 * 60 * 1000 : Infinity;
  const columns = useMemo(() => chartColumns(slots, nextMs === null ? null : new Date(nextMs), lastSlotMs), [slots, nextMs, lastSlotMs]);
  const newestPast = slots.at(-1)?.slotTime;
  const nextColumn = columns.find((column): column is Exclude<ChartColumn, { kind: 'past' }> => column.kind === 'next');
  const side = avgSolveMs !== null ? `gem. ${formatSolveTime(avgSolveMs)} per gebied` : nextColumn ? `volgende om ${nextColumn.hour}:00` : null;
  return (
    <div className="flex min-h-[200px] flex-1 flex-col rounded-[18px] bg-beheer-row p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(LABEL, 'text-muted-foreground')}>Oplos-tempo</span>
        <AnimatePresence mode="wait" initial={false}>
          {side && (
            <motion.span key={side} {...SWAP} className="text-[11.5px] text-muted-foreground">
              {side}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {columns.length === 0 ? (
          <motion.p key="empty" {...SWAP} className="m-auto text-sm text-muted-foreground">
            Nog geen hints
          </motion.p>
        ) : (
          <motion.div key="bars" {...SWAP} className="relative mt-3 flex min-h-0 flex-1 gap-[7px]">
            {/* initial={false} would also block the bars' grow below; with `entrance` the slots fade in as they grow */}
            <AnimatePresence initial={entrance} mode="popLayout">
              {columns.map((column, index) => {
                const past = column.kind === 'past';
                const slotTime = past ? column.slot.slotTime : column.slotTime;
                const hour = past ? column.slot.hour : column.hour;
                const scale = past ? Math.max(AREA_COUNT, column.slot.solved + column.slot.open) : AREA_COUNT;
                return (
                  <motion.div
                    // Keyed by slot: the next slot turning into a published one keeps its column
                    key={slotTime}
                    layout
                    transition={LAYOUT_SPRING}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    title={past ? `${hour}:00 · ${column.slot.solved} van ${column.slot.solved + column.slot.open} opgelost` : `${hour}:00 · verwacht`}
                    className="flex min-w-0 flex-1 flex-col items-center"
                  >
                    <motion.div
                      className="flex w-full max-w-6 flex-1 origin-bottom flex-col justify-end gap-0.5"
                      initial={entrance ? { scaleY: 0 } : false}
                      animate={{ scaleY: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.12 + index * 0.045 }}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        {past ? (
                          <motion.div key="bar" className="flex h-full flex-col justify-end gap-0.5" {...FADE}>
                            <motion.div className="rounded-[4px] bg-orange-300 dark:bg-orange-400/80" initial={false} animate={{ height: `${(column.slot.open / scale) * 100}%` }} transition={LAYOUT_SPRING} />
                            <motion.div className="rounded-[4px] bg-green-400 dark:bg-green-500/80" initial={false} animate={{ height: `${(column.slot.solved / scale) * 100}%` }} transition={LAYOUT_SPRING} />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="expected"
                            {...FADE}
                            className={cn(
                              'h-full rounded-[6px] border-[1.5px] border-dashed transition-colors duration-300',
                              column.kind === 'next' ? 'border-primary/60' : 'border-muted-foreground/30',
                            )}
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                    <span
                      className={cn(
                        'mt-1.5 text-center text-[11px] tabular-nums transition-colors duration-300',
                        column.kind === 'next' ? 'font-bold text-primary' : slotTime === newestPast ? 'font-bold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {hour}
                    </span>
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
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] border-[1.5px] border-dashed border-muted-foreground/50" aria-hidden />
          verwacht
        </span>
      </div>
    </div>
  );
}
