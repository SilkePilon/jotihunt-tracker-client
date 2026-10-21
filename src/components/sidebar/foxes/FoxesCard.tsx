import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreas } from '@/hooks/areas.hook';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import { FOX_GROUP_LABEL, FOX_GROUP_ORDER, groupCounts, legendGroups, type FoxGroup, type SidebarFox } from '@/lib/fox-status';
import { EASE_OUT, REVEAL_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import FoxChip from './FoxChip';
import FoxHistory from './FoxHistory';
import FoxStatusBar from './FoxStatusBar';
import OvBlock from './OvBlock';
import { GROUP_CLASS } from './styles';
import { useSidebarFoxes } from './useSidebarFoxes';

/** A number that swaps with a short vertical fade when it changes. */
function Count({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('relative inline-grid tabular-nums', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * History panel fold: height spring + fade (the spring stops within half a pixel, no long tail); it clips only while it
 * moves, so the timeline's hover card can reach past the panel once open. Folding away is a fixed 0.26 s, so the next
 * panel can follow after {@link PANEL_SWITCH_MS}.
 */
const PANEL_TRANSITION: Transition = { height: { type: 'spring', visualDuration: 0.32, bounce: 0, restDelta: 0.5 }, opacity: { duration: 0.2, ease: EASE_OUT } };
const PANEL_EXIT: Transition = { height: { duration: 0.26, ease: EASE_OUT }, opacity: { duration: 0.16, ease: EASE_OUT } };
const PANEL_TRANSITION_REDUCED: Transition = { height: { duration: 0 }, opacity: { duration: 0.15 } };
/** Switching foxes: the open panel folds away for this long before the next one unfolds. */
const PANEL_SWITCH_MS = 280;

interface HistoryPanelProps {
  id: string;
  reduced: boolean;
  children: ReactNode;
}

/**
 * The fold itself. While unfolding it springs to the content's measured height and retargets when that changes (the
 * skeleton making way for the timeline mid-open), instead of motion's `height: auto`, which measures once and snaps to
 * the real height at the end. Once there it rests at `height: auto` with overflow visible, whenever the data arrives;
 * later scene swaps are animated inside FoxHistory. The gap above is padding inside the measured box, so it can't
 * collapse differently once clipping stops.
 */
function HistoryPanel({ id, reduced, children }: HistoryPanelProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    const element = inner.current;
    if (!element || settled) return;
    const measure = () => setHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [settled]);

  // An interrupted (retargeted) spring also completes: only settle once the fold has really reached the content
  const onComplete = () => {
    if (settled || !outer.current || !inner.current) return;
    if (Math.abs(outer.current.offsetHeight - inner.current.offsetHeight) <= 1) setSettled(true);
  };

  return (
    <motion.div
      ref={outer}
      id={id}
      initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
      animate={{ height: settled ? 'auto' : (height ?? 0), opacity: 1, overflow: settled ? 'visible' : 'hidden' }}
      exit={{ height: 0, opacity: 0, overflow: 'hidden', transition: reduced ? PANEL_TRANSITION_REDUCED : PANEL_EXIT }}
      transition={settled ? { duration: 0 } : reduced ? PANEL_TRANSITION_REDUCED : PANEL_TRANSITION}
      onAnimationComplete={onComplete}
    >
      <div ref={inner} className="pt-2">
        {children}
      </div>
    </motion.div>
  );
}

interface GroupBlockProps {
  group: FoxGroup;
  foxes: SidebarFox[];
  count: number;
  popIn: boolean;
  /** Fox whose chip shows as open (ring, aria-expanded) */
  openKey: string | null;
  /** Fox whose panel is shown in this group, if it's in this group */
  panelFox: SidebarFox | undefined;
  onOpen: (key: string) => void;
}

/** One tonal group: header + chips (or the OV rows), and the history panel of the open fox when it's in this group. */
function GroupBlock({ group, foxes, count, popIn, openKey, panelFox, onOpen }: GroupBlockProps) {
  const { toggleHidden, isHidden } = useAreas();
  const { isForbidden } = useHuntableAreas();
  const reduced = useReducedMotion() ?? false;
  return (
    <div className={cn('rounded-2xl px-2 pt-[7px] pb-2 transition-colors duration-300 motion-reduce:transition-none', GROUP_CLASS[group].block, GROUP_CLASS[group].on)}>
      {group === 'ov' ? (
        <OvBlock foxes={foxes} isHidden={isHidden} isForbidden={isForbidden} popIn={popIn} openKey={openKey} onOpen={onOpen} />
      ) : (
        <>
          <div className="mx-0.5 mb-1.5 flex justify-between text-xs font-bold">
            <span>{FOX_GROUP_LABEL[group]}</span>
            <Count value={count} />
          </div>
          <div className="flex flex-wrap gap-1">
            {/* popLayout: a chip popping out leaves the flow at once, so its neighbours close the gap */}
            <AnimatePresence mode="popLayout" initial={false}>
              {foxes.map((fox) => (
                <FoxChip key={fox.key} fox={fox} hidden={isHidden(fox.area.name)} forbidden={isForbidden(fox.area.name)} popIn={popIn} open={openKey === fox.key} onOpen={() => onOpen(fox.key)} />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
      {/* The open fox's history; follows the fox when it changes group (folds out here, unfolds there) */}
      <AnimatePresence mode="wait">
        {panelFox && (
          <HistoryPanel key={panelFox.key} id={`fox-history-${panelFox.key}`} reduced={reduced}>
            <FoxHistory fox={panelFox} hidden={isHidden(panelFox.area.name)} onToggleHidden={() => toggleHidden(panelFox.area.name)} />
          </HistoryPanel>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "Vossen" card (mockup C2): status bar, count legend, one tonal block per non-empty group with area chips. */
export default function FoxesCard() {
  const foxes = useSidebarFoxes();
  const { isForbidden } = useHuntableAreas();
  const reduced = useReducedMotion() ?? false;
  // One fox open per card: `openKey` follows the taps at once (ring), `panelKey` lags while the old panel folds away
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [laggingPanelKey, setPanelKey] = useState<string | null>(null);
  // The panel only ever shows the open fox; a stale value (open fox gone, a switch timer that fired late) counts as none
  const panelKey = laggingPanelKey === openKey ? laggingPanelKey : null;
  const switchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(switchTimer.current), []);
  const onOpen = (key: string) => {
    const next = openKey === key ? null : key;
    setOpenKey(next);
    clearTimeout(switchTimer.current);
    if (next === null || panelKey === null || reduced) {
      setPanelKey(next);
      return;
    }
    setPanelKey(null);
    switchTimer.current = setTimeout(() => setPanelKey(next), PANEL_SWITCH_MS);
  };
  // The open fox left the list (area removed or renamed): forget it during render, so the next tap opens at once
  // and the panel doesn't come back by itself when the area returns
  if (foxes && openKey !== null && !foxes.some((fox) => fox.key === openKey)) setOpenKey(null);
  // Chips already there on the first render don't pop in; later ones (moved by a status change) do
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!foxes) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2.5 w-full rounded-md" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }
  if (foxes.length === 0) return <p className="text-xs text-muted-foreground">Nog geen vossen</p>;

  const counts = groupCounts(foxes);
  const panelFox = panelKey === null ? undefined : foxes.find((fox) => fox.key === panelKey);
  return (
    <div className="flex flex-col">
      <FoxStatusBar foxes={foxes} size="full" isForbidden={isForbidden} />
      <div className="mt-1.5 mb-2.5 flex justify-between text-[11px] text-muted-foreground">
        {legendGroups(counts).map((group) => (
          <span key={group} className="inline-flex items-baseline gap-1">
            <Count value={counts[group]} className="font-semibold text-foreground" />
            {FOX_GROUP_LABEL[group].toLowerCase()}
          </span>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {FOX_GROUP_ORDER.filter((group) => counts[group] > 0).map((group) => (
          <motion.div
            key={group}
            layout="position"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            transition={REVEAL_TRANSITION}
            className="[&:last-child>div]:pb-0"
          >
            {/* clip only on exit (fold out); entering and resting groups stay overflow-visible so popping chips aren't cut off */}
            {/* pb on the wrapper instead of a gap, so a folding group takes no space */}
            <div className="pb-1.5">
              <GroupBlock
                group={group}
                foxes={foxes.filter((fox) => fox.group === group)}
                count={counts[group]}
                popIn={mounted}
                openKey={openKey}
                panelFox={panelFox?.group === group ? panelFox : undefined}
                onOpen={onOpen}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Collapsed "Vossen" header: the mini status bar. */
export function FoxesSummary() {
  const foxes = useSidebarFoxes();
  const { isForbidden } = useHuntableAreas();
  if (!foxes || foxes.length === 0) return null;
  const counts = groupCounts(foxes);
  return (
    <motion.span className="inline-flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <FoxStatusBar foxes={foxes} size="mini" isForbidden={isForbidden} />
      <span className="sr-only">{`${counts.green} actief, ${counts.orange} onderweg, ${counts.ov ? `${counts.ov} met OV, ` : ''}${counts.cooldown} cooldown, ${counts.red} inactief`}</span>
    </motion.span>
  );
}
