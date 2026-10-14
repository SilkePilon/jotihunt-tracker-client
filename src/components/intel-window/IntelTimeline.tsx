import { createContext, type ReactNode, type RefObject, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { ClockIcon } from 'lucide-react';
import { Tag } from '@/components/beheer/controls/Pill';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, type DeadlineTone, KIND_COLOR, KIND_LABEL, areaStates, deadlineLabel, deadlineTone, groupByDay, solvedCount } from '@/lib/intel-window';
import { EASE_OUT } from '@/lib/motion';
import { useHasMounted } from '@/hooks/has-mounted.hook';
import { areaOptions, cn } from '@/lib/utils';
import type { AssignmentStatus, IntelItem, IntelKind, IntelTab } from '@/types/Intel';
import { AreaChip, AreaStrip } from './AreaChips';

const STEP = { compact: 0.02, wide: 0.022 };
const BASE = { compact: 0.19, wide: 0.21 };
const FOLD = { duration: 0.22, ease: EASE_OUT } as const;

/**
 * The list swaps (wide ↔ compact, or another tab) while hidden: the old one fades out, then the new one staggers in.
 * `custom` is the list's own mode (not passed through AnimatePresence, so an exiting list keeps its own): the wide list
 * leaves with x −12 / 0.13 s, the compact one with x −10 / 0.14 s.
 *
 * Labels: `hidden` = start of a staggered list entrance, `insert` = mounted while the list is on screen (no offset:
 * its `Fold` unfolds it instead), `shown` = in place. Children inherit the list's `initial` label, so the list's first
 * paint uses `false` (no entrance), then `insert` once mounted. `shown` never touches height: only a `Fold` measures it.
 */
const list: Variants = {
  hidden: {},
  insert: {},
  shown: {},
  gone: (compact: boolean) => ({ opacity: 0, x: compact ? -10 : -12, transition: { duration: compact ? 0.14 : 0.13, ease: 'easeIn' } }),
};
/** A day: staggers its header and items, starting after everything above it, so the cascade runs top to bottom */
const day: Variants = {
  hidden: {},
  insert: {},
  shown: ({ compact, offset }: { compact: boolean; offset: number }) => {
    const step = compact ? STEP.compact : STEP.wide;
    return { transition: { delayChildren: (compact ? BASE.compact : BASE.wide) + offset * step, staggerChildren: step } };
  },
};
const entry: Variants = {
  hidden: (compact: boolean) => ({ opacity: 0, x: compact ? 16 : 0, y: compact ? 0 : 8 }),
  insert: {},
  shown: { opacity: 1, x: 0, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
};

/** Whether something mounting here now arrives while its list is on screen (and should unfold) */
const InsertContext = createContext(false);

/**
 * Unfolds (height + opacity) when it mounts while its list is already on screen, folds away when it leaves on its own.
 * It has no padding and clips vertically (`clip`, not `hidden`: no scroll container, so sticky day headers keep working),
 * so the fold runs to exactly zero. Inside a Fold that is still unfolding, nested Folds don't unfold again.
 */
function Fold({ children }: { children: ReactNode }) {
  const parentInserting = useContext(InsertContext);
  const [inserting] = useState(parentInserting);
  const mounted = useHasMounted();
  return (
    <motion.div
      initial={inserting ? { height: 0, opacity: 0 } : false}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={FOLD}
      className="overflow-y-clip [overflow-clip-margin:3px]"
    >
      <InsertContext.Provider value={mounted}>{children}</InsertContext.Provider>
    </motion.div>
  );
}

/** Ticks once a minute: deadlines and day labels */
function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

interface TimelineProps {
  items: IntelItem[];
  compact: boolean;
  /** Part of the list's key: a tab switch swaps the whole list */
  tab: IntelTab;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** The scrolling column: the wide list's scroll position is put back when the split closes */
  scrollRef: RefObject<HTMLDivElement | null>;
}

/**
 * Day-grouped timeline: wide cards with a time rail, or compact rows when an item is open on the right.
 *
 * The parent column animates its width; the lists inside never follow it while visible. The wide list is laid out at
 * the full row width (`100cqw` of the split row) and is only clipped by the column, so its text never re-wraps; the
 * compact rows are single-line (truncated). No entrance animation on the first paint.
 */
export default function IntelTimeline({ items, compact, tab, selectedId, onSelect, scrollRef }: TimelineProps) {
  const now = useMinute();
  const mounted = useHasMounted();
  const groups = groupByDay(items, now);
  const wideTop = useRef<{ top: number; tab: IntelTab } | null>(null);
  useEffect(() => {
    // Runs right after the split opens, while the wide list is still on screen (fading out)
    if (compact && scrollRef.current) wideTop.current = { top: scrollRef.current.scrollTop, tab };
    // Only the tab at the moment the split opens counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, scrollRef]);

  return (
    <AnimatePresence mode="wait">
      <TimelineList
        key={`${compact ? 'compact' : 'wide'}-${tab}`}
        compact={compact}
        skipEntrance={!mounted}
        onMount={() => {
          if (compact) return;
          // Back to where the wide list was, unless the tab changed in between (another list)
          if (wideTop.current?.tab === tab && scrollRef.current) scrollRef.current.scrollTop = wideTop.current.top;
          wideTop.current = null;
        }}
      >
        <AnimatePresence>
          {groups.length === 0 && (
            <Fold key="empty">
              <motion.p custom={compact} variants={entry} className="py-10 text-center text-sm text-muted-foreground">
                Nog niets gepubliceerd
              </motion.p>
            </Fold>
          )}
          {groups.map((group, index) => (
            <Fold key={group.key}>
              <motion.section custom={{ compact, offset: groups.slice(0, index).reduce((sum, before) => sum + 1 + before.items.length, 0) }} variants={day}>
                <motion.h3
                  custom={compact}
                  variants={entry}
                  className={cn(
                    'sticky top-0 z-10 bg-linear-to-b from-beheer-window from-70% to-transparent pt-3.5 pb-2 text-[11.5px] font-extrabold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase',
                    compact ? 'pl-1.5' : 'pl-[66px]',
                  )}
                >
                  {group.label}
                </motion.h3>
                <AnimatePresence>
                  {group.items.map((item) => (
                    <Fold key={item.id}>
                      {compact ? (
                        // 2px + 2px: a 4px gap between rows, inside the fold
                        <motion.div custom={compact} variants={entry} className="py-0.5">
                          <CompactRow item={item} now={now} selected={item.id === selectedId} onSelect={onSelect} />
                        </motion.div>
                      ) : (
                        <motion.div custom={compact} variants={entry} className="grid grid-cols-[52px_14px_1fr] gap-x-2.5">
                          <div className="pt-[15px] text-right text-xs text-muted-foreground tabular-nums">{formatClock(item.publishAt)}</div>
                          <div className="relative before:absolute before:inset-y-0 before:left-1.5 before:w-0.5 before:bg-beheer-row-high">
                            <span className="absolute top-[18px] left-0.5 size-2.5 rounded-full ring-2 ring-beheer-window" style={{ backgroundColor: KIND_COLOR[item.kind] }} />
                          </div>
                          <WideCard item={item} now={now} onSelect={onSelect} />
                        </motion.div>
                      )}
                    </Fold>
                  ))}
                </AnimatePresence>
              </motion.section>
            </Fold>
          ))}
        </AnimatePresence>
      </TimelineList>
    </AnimatePresence>
  );
}

/** One list (one mode + tab). `skipEntrance` and `onMount` are read once, when it mounts. */
function TimelineList({ compact, skipEntrance, onMount, children }: { compact: boolean; skipEntrance: boolean; onMount: () => void; children: ReactNode }) {
  const [skip] = useState(skipEntrance);
  const mounted = useHasMounted();
  const mountRef = useRef(onMount);
  useLayoutEffect(() => {
    mountRef.current();
  }, []);
  return (
    <motion.div
      custom={compact}
      variants={list}
      // Read by motion only on mount for the list itself; its children inherit it when they mount
      initial={mounted ? 'insert' : skip ? false : 'hidden'}
      animate="shown"
      exit="gone"
      className={compact ? 'w-full px-4 pb-8' : 'w-[100cqw] pr-[200px] pb-8 pl-[150px]'}
    >
      <InsertContext.Provider value={mounted}>{children}</InsertContext.Provider>
    </motion.div>
  );
}

/** The "ongelezen" dot; grows from zero width (cancelling the flex gap) so the title slides instead of jumping */
function UnreadDot({ unread }: { unread: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {unread && (
        <motion.span
          key="dot"
          initial={{ width: 0, marginRight: -8, scale: 0 }}
          animate={{ width: 7, marginRight: 0, scale: 1 }}
          exit={{ width: 0, marginRight: -8, scale: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="h-[7px] shrink-0 rounded-full bg-primary"
          aria-label="ongelezen"
        />
      )}
    </AnimatePresence>
  );
}

function WideCard({ item, now, onSelect }: { item: IntelItem; now: number; onSelect: (id: number) => void }) {
  const states = item.kind === 'hint' ? areaStates(item.cells) : null;
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  const status = item.assignment?.status ?? 'open';
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="my-[5px] w-full rounded-[20px] bg-card px-[15px] py-[13px] text-left outline-none transition-colors hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex items-center gap-2">
        <UnreadDot unread={item.unread} />
        <span className="text-[14.5px] font-bold">{item.title}</span>
        <KindTag kind={item.kind} />
        {count && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {count.solved}/{count.total} opgelost
          </span>
        )}
        {item.kind === 'assignment' && item.endTime && (
          <DeadlineTag endTime={item.endTime} now={now} status={status} className="ml-auto shrink-0" />
        )}
      </span>
      {item.summary && <span className="mt-[3px] line-clamp-2 block text-xs text-muted-foreground">{item.summary}</span>}
      {states && (
        <span className="mt-2.5 flex flex-wrap gap-1">
          {areaOptions.map(({ value, label }) => (
            <AreaChip key={value} area={value} state={states[value]} label={label} />
          ))}
        </span>
      )}
      {item.kind === 'assignment' && (
        <span className="mt-2.5 flex gap-1.5">
          <Tag>{ASSIGNMENT_STATUS_LABELS[status]}</Tag>
          <Tag>{item.assignment?.owner?.name ?? 'niemand'}</Tag>
          {item.maxPoints ? <Tag>max {item.maxPoints} pt</Tag> : null}
        </span>
      )}
    </button>
  );
}

function CompactRow({ item, now, selected, onSelect }: { item: IntelItem; now: number; selected: boolean; onSelect: (id: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!selected) return;
    // After the open choreography (the column is done shrinking) the selected row is scrolled into view
    const timer = setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 450);
    return () => clearTimeout(timer);
  }, [selected]);
  const status = item.assignment?.status ?? 'open';
  return (
    <button
      ref={ref}
      type="button"
      aria-current={selected || undefined}
      onClick={() => onSelect(item.id)}
      className={cn(
        'flex w-full gap-2.5 rounded-[14px] bg-card px-3 py-2.5 text-left outline-none transition-[background-color,box-shadow] duration-200 hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected ? 'shadow-[0_0_0_2px_var(--primary)]' : 'shadow-[0_0_0_0_var(--primary)]',
      )}
    >
      <span className="w-1 shrink-0 self-stretch rounded" style={{ backgroundColor: KIND_COLOR[item.kind] }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <UnreadDot unread={item.unread} />
          <span className="truncate text-[13.5px] font-bold">{item.title}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{formatClock(item.publishAt)}</span>
        </span>
        {/* Single line, whatever the kind: the column resizes around these rows while they enter */}
        <span className="mt-1 flex min-w-0">
          {item.kind === 'hint' ? (
            <AreaStrip cells={item.cells} />
          ) : item.kind === 'assignment' ? (
            <span className="truncate text-xs text-muted-foreground">
              {item.endTime && (
                <>
                  <span className={cn('transition-colors duration-300', DEADLINE_TEXT[deadlineTone(item.endTime, now, status)])}>{deadlineLabel(item.endTime, now)}</span>
                  {' · '}
                </>
              )}
              {ASSIGNMENT_STATUS_LABELS[status]}
            </span>
          ) : (
            <span className="truncate text-xs text-muted-foreground">{item.summary ?? ''}</span>
          )}
        </span>
      </span>
    </button>
  );
}

/** Deadline colours, the same in the wide card, the compact row and the detail header */
const DEADLINE_TAG = { done: 'neutral', expired: 'danger', urgent: 'warn', calm: 'info' } as const satisfies Record<DeadlineTone, string>;
const DEADLINE_TEXT: Record<DeadlineTone, string> = {
  done: 'text-muted-foreground',
  expired: 'text-destructive dark:text-red-300',
  urgent: 'font-semibold text-amber-700 dark:text-amber-300',
  calm: 'text-sky-700 dark:text-sky-300',
};

/** "nog 42 min": muted once submitted or skipped, red when expired, amber under an hour, else blue; the colour eases between them */
export function DeadlineTag({ endTime, now, status, className }: { endTime: string; now: number; status: AssignmentStatus; className?: string }) {
  return (
    <Tag tone={DEADLINE_TAG[deadlineTone(endTime, now, status)]} className={className}>
      <ClockIcon />
      {deadlineLabel(endTime, now)}
    </Tag>
  );
}

export function KindTag({ kind }: { kind: IntelKind }) {
  return (
    <span
      className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold"
      style={{ color: KIND_COLOR[kind], backgroundColor: `color-mix(in oklab, ${KIND_COLOR[kind]} 14%, transparent)` }}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}
