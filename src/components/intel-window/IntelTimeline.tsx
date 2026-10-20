import { createContext, type ReactNode, useContext, useState } from 'react';
import { useNow } from '@/hooks/now.hook';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { ClipboardListIcon, ClockIcon, LightbulbIcon, type LucideIcon, MegaphoneIcon } from 'lucide-react';
import CookieBadge from '@/components/tracker/CookieBadge';
import SuccessBadge from '@/components/auth/SuccessBadge';
import { Tag } from '@/components/beheer/controls/Pill';
import { formatClock } from '@/lib/format';
import { type DeadlineTone, type MetaSegment, type MetaTone, assignmentMeta, assignmentStatusLabel, INTEL_TAB_ORDER, isHintDone, KIND_COLOR, KIND_LABEL, areaStates, deadlineLabel, deadlineTone, groupByDay, siteSubmission, solvedCount } from '@/lib/intel-window';
import { EASE_OUT, REVEAL_TRANSITION, SWAP_TRANSITION } from '@/lib/motion';
import { useHasMounted } from '@/hooks/has-mounted.hook';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import type { AreaState, AssignmentStatus, IntelItem, IntelKind, IntelTab } from '@/types/Intel';

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

/** Day-grouped timeline: per day one tonal card of rows. */
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
                  <motion.h3 variants={entry} className="sticky top-0 z-10 bg-linear-to-b from-beheer-window from-70% to-transparent pt-3.5 pb-2 pl-1 text-[11.5px] font-extrabold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase">
                    {group.label}
                  </motion.h3>
                  {/* The window colour shows through the 2px gaps as row separators */}
                  <div className="flex flex-col gap-0.5 overflow-hidden rounded-[20px] bg-beheer-window">
                    <AnimatePresence>
                      {group.items.map((item) => (
                        <Fold key={item.id}>
                          <motion.div variants={entry}>
                            <Row item={item} now={now} onSelect={onSelect} />
                          </motion.div>
                        </Fold>
                      ))}
                    </AnimatePresence>
                  </div>
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

const KIND_ICON: Record<IntelKind, LucideIcon> = { news: MegaphoneIcon, assignment: ClipboardListIcon, hint: LightbulbIcon };

const META_TONE: Record<MetaTone, string> = {
  muted: '',
  ok: 'text-green-600 dark:text-green-400',
  info: 'text-blue-500 dark:text-blue-400',
  warn: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};

/**
 * One row of a day group: kind tile, title, grey line. `--row-bg` is the row's background (card, lighter on hover); the
 * badges on the tile ring themselves in it so they cut out cleanly.
 */
function Row({ item, now, onSelect }: { item: IntelItem; now: number; onSelect: (id: number) => void }) {
  const done = item.kind === 'assignment' ? !!siteSubmission(item.assignment)?.judged : item.kind === 'hint' && isHintDone(item.cells);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="flex w-full items-center gap-3 bg-(--row-bg) px-3.5 py-[11px] text-left outline-none transition-colors [--row-bg:var(--card)] hover:[--row-bg:var(--beheer-row)] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      <KindTile kind={item.kind} unread={item.unread} done={done} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          <span className="tabular-nums">{formatClock(item.publishAt)}</span>
          <RowMeta item={item} now={now} />
        </span>
      </span>
    </button>
  );
}

/** Tonal kind tile; a white dot top-right while unread, a green cookie check bottom-right once judged / fully solved */
function KindTile({ kind, unread, done }: { kind: IntelKind; unread: boolean; done: boolean }) {
  const Icon = KIND_ICON[kind];
  // As AreaChip did: a check that appears on screen pops in (SuccessBadge), one mounted done is static
  const [poppable, setPoppable] = useState(!done);
  if (!done && !poppable) setPoppable(true);
  return (
    <span
      className="relative grid size-[34px] shrink-0 place-items-center rounded-xl"
      style={{ color: KIND_COLOR[kind], backgroundColor: `color-mix(in oklab, ${KIND_COLOR[kind]} 16%, var(--card))` }}
    >
      <Icon className="size-[17px]" strokeWidth={2.2} />
      <AnimatePresence initial={false}>
        {unread && (
          <motion.span
            key="unread"
            aria-label="ongelezen"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={REVEAL_TRANSITION}
            className="absolute -top-0.5 -right-0.5 size-[9px] rounded-full bg-foreground shadow-[0_0_0_2.5px_var(--row-bg)]"
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {done && (
          <motion.span
            key="done"
            exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
            className="absolute -right-1 -bottom-1 grid place-items-center rounded-full bg-(--row-bg) p-0.5"
          >
            {poppable ? <SuccessBadge size={16} /> : <CookieBadge tone="ok" size={16} />}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** The rest of the grey line after the time */
function RowMeta({ item, now }: { item: IntelItem; now: number }) {
  if (item.kind === 'news') return item.summary ? <> · {item.summary}</> : null;
  if (item.kind === 'hint') return <HintMeta cells={item.cells} />;
  return assignmentMeta(item, now).map((segment, index) => <MetaPart key={index} segment={segment} />);
}

/** " · text"; a new text fades in, a new colour eases */
function MetaPart({ segment }: { segment: MetaSegment }) {
  return (
    <>
      {' · '}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={segment.text}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn('transition-colors', META_TONE[segment.tone])}
        >
          {segment.text}
        </motion.span>
      </AnimatePresence>
    </>
  );
}

/** " · ●○○○ 1/8 opgelost": a dot per area in its colour (filled = solved, ring = open, faint ring = no hint) */
function HintMeta({ cells }: { cells: IntelItem['cells'] }) {
  const states = areaStates(cells);
  const { solved, total } = solvedCount(cells);
  return (
    <>
      {' · '}
      <span className="mr-1.5 inline-flex gap-[3px] align-middle">
        {areaOptions.map(({ value, label }) => (
          <AreaDot key={value} area={value} label={label} state={states[value]} />
        ))}
      </span>
      <span className={cn('transition-colors', total > 0 && solved === total && META_TONE.ok)}>
        {solved}/{total} opgelost
      </span>
    </>
  );
}

const AREA_TITLE: Record<AreaState, string> = { solved: 'opgelost', open: 'nog open', none: 'geen hint', missing: 'geen hint' };

/** Fills (with a short pop) when its area gets solved on screen; mounting solved just shows it filled */
function AreaDot({ area, label, state }: { area: string; label: string; state: AreaState }) {
  const color = getColorFromArea(area);
  const solved = state === 'solved';
  return (
    <motion.span
      title={`${label}: ${AREA_TITLE[state]}`}
      initial={false}
      animate={{ scale: solved ? [1, 1.6, 1] : 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="block size-[7px] rounded-full transition-[background-color,box-shadow,opacity] duration-200"
      style={{
        backgroundColor: solved ? color : 'transparent',
        boxShadow: solved ? 'none' : `inset 0 0 0 1.5px ${color}`,
        opacity: solved ? 1 : state === 'open' ? 0.7 : 0.3,
      }}
    />
  );
}

/** Our status, or green "Beoordeeld · 8 pt" once jotihunt.nl judged it; the new label fades in */
export function AssignmentStatusTag({ item }: { item: IntelItem }) {
  const { label, judged } = assignmentStatusLabel(item.assignment);
  return (
    <Tag tone={judged ? 'ok' : 'neutral'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {label}
        </motion.span>
      </AnimatePresence>
    </Tag>
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
