import { createContext, type ReactNode, useContext, useState } from 'react';
import { useNow } from '@/hooks/now.hook';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { ClockIcon } from 'lucide-react';
import { Tag } from '@/components/beheer/controls/Pill';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, type DeadlineTone, INTEL_TAB_ORDER, KIND_COLOR, KIND_LABEL, areaStates, deadlineLabel, deadlineTone, groupByDay, solvedCount } from '@/lib/intel-window';
import { EASE_OUT, REVEAL_TRANSITION, SWAP_TRANSITION } from '@/lib/motion';
import { useHasMounted } from '@/hooks/has-mounted.hook';
import { areaOptions } from '@/lib/utils';
import type { AssignmentStatus, IntelItem, IntelKind, IntelTab } from '@/types/Intel';
import { AreaChip } from './AreaChips';

const STEP = 0.022;
const BASE = 0.21;

/**
 * A tab switch pushes the list sideways: the old one leaves away from the new tab (x ∓30px, 0.16 s), the new one comes
 * in from its side (0.28 s). `custom` = direction (1: the new tab is further right). Labels: `hidden` = window just
 * opened (the cards stagger in, the list itself is still), `push` = a tab switch, `insert` = mounted while on screen.
 */
const list: Variants = {
  hidden: {},
  push: (direction: number) => ({ opacity: 0, x: 30 * direction }),
  insert: {},
  shown: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } },
  gone: (direction: number) => ({ opacity: 0, x: -30 * direction, transition: { duration: 0.16, ease: 'easeIn' } }),
};
/** A day: staggers its header and items, starting after everything above it, so the cascade runs top to bottom */
const day: Variants = {
  hidden: {},
  insert: {},
  shown: (offset: number) => ({ transition: { delayChildren: BASE + offset * STEP, staggerChildren: STEP } }),
};
/** A header or row. No `push` key: on a tab switch the rows ride along with the list instead of staggering. */
const entry: Variants = {
  hidden: { opacity: 0, y: 8 },
  insert: {},
  shown: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
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
      transition={SWAP_TRANSITION}
      className="overflow-y-clip [overflow-clip-margin:3px]"
    >
      <InsertContext.Provider value={mounted}>{children}</InsertContext.Provider>
    </motion.div>
  );
}

/** Ticks once a minute: deadlines and day labels */
function useMinute() {
  return useNow(true, 60_000);
}

interface TimelineProps {
  items: IntelItem[];
  /** Part of the list's key: a tab switch pushes the whole list sideways */
  tab: IntelTab;
  onSelect: (id: number) => void;
  /** Read on mount: the window just opened, so the cards stagger in */
  entrance: boolean;
}

/** Day-grouped timeline of wide cards with a time rail. */
export default function IntelTimeline({ items, tab, onSelect, entrance }: TimelineProps) {
  const now = useMinute();
  const groups = groupByDay(items, now);
  // Derived during render: which way the last tab switch went, and whether there was one (only the first list may stagger in)
  const [last, setLast] = useState({ tab, direction: 1, switched: false });
  if (last.tab !== tab) setLast({ tab, direction: INTEL_TAB_ORDER.indexOf(tab) > INTEL_TAB_ORDER.indexOf(last.tab) ? 1 : -1, switched: true });
  const [stagger] = useState(entrance);
  // Reduced motion: the lists cross-fade in place
  const direction = useReducedMotion() ? 0 : last.direction;

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <TimelineList key={tab} start={last.switched ? 'push' : stagger ? 'hidden' : false} direction={direction}>
        {/* Outside the padded list: centred in the whole window */}
        <AnimatePresence>
          {groups.length === 0 && (
            <Fold key="empty">
              <motion.p variants={entry} className="py-10 text-center text-sm text-muted-foreground">
                Nog niets gepubliceerd
              </motion.p>
            </Fold>
          )}
        </AnimatePresence>
        <div className="pr-2">
          <AnimatePresence>
            {groups.map((group, index) => (
              <Fold key={group.key}>
                <motion.section custom={groups.slice(0, index).reduce((sum, before) => sum + 1 + before.items.length, 0)} variants={day}>
                  <motion.h3
                    variants={entry}
                    className="sticky top-0 z-10 bg-linear-to-b from-beheer-window from-70% to-transparent pt-3.5 pb-2 pl-[66px] text-[11.5px] font-extrabold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase"
                  >
                    {group.label}
                  </motion.h3>
                  <AnimatePresence>
                    {group.items.map((item) => (
                      <Fold key={item.id}>
                        <motion.div data-intel-id={item.id} variants={entry} className="grid grid-cols-[52px_14px_1fr] gap-x-2.5">
                          <div className="pt-[15px] text-right text-xs text-muted-foreground tabular-nums">{formatClock(item.publishAt)}</div>
                          <div className="relative before:absolute before:inset-y-0 before:left-1.5 before:w-0.5 before:bg-beheer-row-high">
                            <span className="absolute top-[18px] left-0.5 size-2.5 rounded-full ring-2 ring-beheer-window" style={{ backgroundColor: KIND_COLOR[item.kind] }} />
                          </div>
                          <WideCard item={item} now={now} onSelect={onSelect} />
                        </motion.div>
                      </Fold>
                    ))}
                  </AnimatePresence>
                </motion.section>
              </Fold>
            ))}
          </AnimatePresence>
        </div>
      </TimelineList>
    </AnimatePresence>
  );
}

/**
 * One list (one tab). `start` is read once, when it mounts. What mounts with the list arrives with it (rides along or
 * staggers in); only what mounts after the list's first paint unfolds.
 */
function TimelineList({ start, direction, children }: { start: 'hidden' | 'push' | false; direction: number; children: ReactNode }) {
  const [initial] = useState(start);
  const mounted = useHasMounted();
  return (
    <motion.div
      custom={direction}
      variants={list}
      // Read by motion only on mount for the list itself; its children inherit it when they mount, so later ones get `insert`
      initial={mounted ? 'insert' : initial}
      animate="shown"
      exit="gone"
      className="w-full pb-8"
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
          transition={REVEAL_TRANSITION}
          className="h-[7px] shrink-0 rounded-full bg-primary"
          aria-label="ongelezen"
        />
      )}
    </AnimatePresence>
  );
}

/** The card: a plain button whose background is the frame */
function WideCard({ item, now, onSelect }: { item: IntelItem; now: number; onSelect: (id: number) => void }) {
  const states = item.kind === 'hint' ? areaStates(item.cells) : null;
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  const status = item.assignment?.status ?? 'open';
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="my-[5px] block w-full rounded-[20px] bg-card px-[15px] py-[13px] text-left outline-none transition-colors hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
        {item.kind === 'assignment' && item.endTime && <DeadlineTag endTime={item.endTime} now={now} status={status} className="ml-auto shrink-0" />}
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

/** Deadline colours, the same in the card and the detail header */
const DEADLINE_TAG = { done: 'neutral', expired: 'danger', urgent: 'warn', calm: 'info' } as const satisfies Record<DeadlineTone, string>;

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
