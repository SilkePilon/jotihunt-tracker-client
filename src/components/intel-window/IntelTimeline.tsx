import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { ClockIcon } from 'lucide-react';
import { Tag } from '@/components/beheer/controls/Pill';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, type DeadlineTone, INTEL_MORPH, KIND_COLOR, KIND_LABEL, areaStates, deadlineLabel, deadlineTone, groupByDay, solvedCount } from '@/lib/intel-window';
import { EASE_OUT } from '@/lib/motion';
import { useHasMounted } from '@/hooks/has-mounted.hook';
import { areaOptions, cn } from '@/lib/utils';
import type { AssignmentStatus, IntelItem, IntelKind, IntelTab } from '@/types/Intel';
import { AreaChip } from './AreaChips';
import { useMorphIds } from './morph';

const STEP = 0.022;
const BASE = 0.21;
const FOLD = { duration: 0.22, ease: EASE_OUT } as const;

/**
 * Another tab swaps the list while hidden: the old one fades out (x −12 / 0.13 s), then the new one staggers in.
 *
 * Labels: `hidden` = start of a staggered list entrance, `insert` = mounted while the list is on screen (no offset:
 * its `Fold` unfolds it instead), `shown` = in place. Children inherit the list's `initial` label, so the list's first
 * paint uses `false` (no entrance), then `insert` once mounted. `shown` never touches height: only a `Fold` measures it.
 */
const list: Variants = {
  hidden: {},
  insert: {},
  shown: {},
  gone: { opacity: 0, x: -12, transition: { duration: 0.13, ease: 'easeIn' } },
};
/** A day: staggers its header and items, starting after everything above it, so the cascade runs top to bottom */
const day: Variants = {
  hidden: {},
  insert: {},
  shown: (offset: number) => ({ transition: { delayChildren: BASE + offset * STEP, staggerChildren: STEP } }),
};
/** `custom` = returning: the row of the card that morphs back from the detail stays in place (its frame and title morph) */
const entry: Variants = {
  hidden: (returning: boolean) => (returning ? {} : { opacity: 0, y: 8 }),
  insert: {},
  shown: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
};
/** The rest of a returning row (time, rail, tags, chips): fades in once its frame has nearly landed. Inert for other rows. */
const settle: Variants = {
  hidden: (returning: boolean) => (returning ? { opacity: 0 } : {}),
  insert: {},
  shown: { opacity: 1, transition: { duration: 0.26, delay: 0.22, ease: EASE_OUT } },
};

/** Whether something mounting here now arrives while its list is on screen (and should unfold) */
const InsertContext = createContext(false);

/**
 * Unfolds (height + opacity) when it mounts while its list is already on screen, folds away when it leaves on its own.
 * It has no padding and clips vertically (`clip`, not `hidden`: no scroll container, so sticky day headers keep working),
 * so the fold runs to exactly zero. Inside a Fold that is still unfolding, nested Folds don't unfold again. `clip={false}`
 * while a card flies home through it (the back morph), which a clip would cut off.
 */
function Fold({ clip = true, children }: { clip?: boolean; children: ReactNode }) {
  const parentInserting = useContext(InsertContext);
  const [inserting] = useState(parentInserting);
  const mounted = useHasMounted();
  return (
    <motion.div
      initial={inserting ? { height: 0, opacity: 0 } : false}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={FOLD}
      className={clip ? 'overflow-y-clip [overflow-clip-margin:3px]' : undefined}
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
  /** Part of the list's key: a tab switch swaps the whole list */
  tab: IntelTab;
  onSelect: (id: number) => void;
  /** Read on mount: the window opened on the timeline (no entrance on the first paint) */
  skipEntrance: boolean;
  /** Read on mount: the item whose detail just closed; its card morphs back into place instead of fading in */
  returnId: number | null;
}

/**
 * Day-grouped timeline of wide cards with a time rail. Each card's frame and title share a `layoutId` with the detail
 * header (IntelDetail), so opening an item morphs the card into it and going back morphs it home. No entrance on the first paint.
 */
export default function IntelTimeline({ items, tab, onSelect, skipEntrance, returnId: initialReturnId }: TimelineProps) {
  const now = useMinute();
  const mounted = useHasMounted();
  const [skipFirst] = useState(skipEntrance);
  const groups = groupByDay(items, now);
  // Only the first list returns a card: after a tab switch nothing morphs back
  const [returnId] = useState(initialReturnId);
  const [firstTab] = useState(tab);
  const [tabChanged, setTabChanged] = useState(false);
  if (!tabChanged && tab !== firstTab) setTabChanged(true);
  const morphId = tabChanged ? null : returnId;
  // The returning card flies home unclipped (its Folds) and above its neighbours and the sticky day header, until its
  // frame has landed (or after 1.5 s, when no morph ran: reduced motion, card not found)
  const [lifted, setLifted] = useState(returnId !== null);
  useEffect(() => {
    if (!lifted) return;
    const timer = setTimeout(() => setLifted(false), 1500);
    return () => clearTimeout(timer);
  }, [lifted]);

  return (
    <AnimatePresence mode="wait">
      <TimelineList key={tab} skipEntrance={skipFirst && !mounted}>
        {/* Outside the padded list: centred in the whole window */}
        <AnimatePresence>
          {groups.length === 0 && (
            <Fold key="empty">
              <motion.p custom={false} variants={entry} className="py-10 text-center text-sm text-muted-foreground">
                Nog niets gepubliceerd
              </motion.p>
            </Fold>
          )}
        </AnimatePresence>
        <div className="pr-[200px] pl-[150px]">
          <AnimatePresence>
            {groups.map((group, index) => {
              const flying = lifted && group.items.some((item) => item.id === morphId);
              return (
                <Fold key={group.key} clip={!flying}>
                  <motion.section custom={groups.slice(0, index).reduce((sum, before) => sum + 1 + before.items.length, 0)} variants={day}>
                    <motion.h3
                      custom={false}
                      variants={entry}
                      className="sticky top-0 z-10 bg-linear-to-b from-beheer-window from-70% to-transparent pt-3.5 pb-2 pl-[66px] text-[11.5px] font-extrabold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase"
                    >
                      {group.label}
                    </motion.h3>
                    <AnimatePresence>
                      {group.items.map((item) => {
                        const returning = item.id === morphId;
                        return (
                          <Fold key={item.id} clip={!(returning && lifted)}>
                            <motion.div
                              data-intel-id={item.id}
                              custom={returning}
                              variants={entry}
                              className={cn('grid grid-cols-[52px_14px_1fr] gap-x-2.5', returning && lifted && 'relative z-20')}
                            >
                              <motion.div custom={returning} variants={settle} className="pt-[15px] text-right text-xs text-muted-foreground tabular-nums">
                                {formatClock(item.publishAt)}
                              </motion.div>
                              <motion.div custom={returning} variants={settle} className="relative before:absolute before:inset-y-0 before:left-1.5 before:w-0.5 before:bg-beheer-row-high">
                                <span className="absolute top-[18px] left-0.5 size-2.5 rounded-full ring-2 ring-beheer-window" style={{ backgroundColor: KIND_COLOR[item.kind] }} />
                              </motion.div>
                              <WideCard item={item} now={now} returning={returning} onSelect={onSelect} onLanded={returning ? () => setLifted(false) : undefined} />
                            </motion.div>
                          </Fold>
                        );
                      })}
                    </AnimatePresence>
                  </motion.section>
                </Fold>
              );
            })}
          </AnimatePresence>
        </div>
      </TimelineList>
    </AnimatePresence>
  );
}

/** One list (one tab). `skipEntrance` is read once, when it mounts. */
function TimelineList({ skipEntrance, children }: { skipEntrance: boolean; children: ReactNode }) {
  const [skip] = useState(skipEntrance);
  const mounted = useHasMounted();
  return (
    <motion.div
      variants={list}
      // Read by motion only on mount for the list itself; its children inherit it when they mount
      initial={mounted ? 'insert' : skip ? false : 'hidden'}
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
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="h-[7px] shrink-0 rounded-full bg-primary"
          aria-label="ongelezen"
        />
      )}
    </AnimatePresence>
  );
}

/**
 * The card. Its background is a separate frame (`layoutId` intel-card-<id>) and its title moves on its own
 * (`layoutId` intel-title-<id>, position only): the frame scales into the detail header and back while the text never
 * stretches; the title crossfades with the detail title on the way. `returning`: tags and chips fade in after the morph.
 */
function WideCard({ item, now, returning, onSelect, onLanded }: { item: IntelItem; now: number; returning: boolean; onSelect: (id: number) => void; onLanded?: () => void }) {
  const states = item.kind === 'hint' ? areaStates(item.cells) : null;
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  const morph = useMorphIds(item.id);
  const status = item.assignment?.status ?? 'open';
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="group relative my-[5px] block w-full rounded-[20px] px-[15px] py-[13px] text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <motion.span
        layoutId={morph.card}
        // Fixed and different from the detail header's: only the morph animates, not every change in the card's size
        layoutDependency="card"
        layoutCrossfade={false}
        onLayoutAnimationComplete={onLanded}
        transition={INTEL_MORPH}
        // Set as a style so motion corrects the corners while the frame scales
        style={{ borderRadius: 20 }}
        className="absolute inset-0 bg-card transition-colors group-hover:bg-beheer-row"
        aria-hidden
      />
      <span className="relative flex items-center gap-2">
        <UnreadDot unread={item.unread} />
        <motion.span layoutId={morph.title} layoutDependency="card" layout="position" transition={INTEL_MORPH} className="text-[14.5px] font-bold">
          {item.title}
        </motion.span>
        <motion.span custom={returning} variants={settle} className="flex flex-1 items-center gap-2">
          <KindTag kind={item.kind} />
          {count && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {count.solved}/{count.total} opgelost
            </span>
          )}
          {item.kind === 'assignment' && item.endTime && <DeadlineTag endTime={item.endTime} now={now} status={status} className="ml-auto shrink-0" />}
        </motion.span>
      </span>
      <motion.span custom={returning} variants={settle} className="relative block">
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
      </motion.span>
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
