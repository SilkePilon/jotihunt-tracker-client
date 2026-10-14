import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreas } from '@/hooks/areas.hook';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import { FOX_GROUP_LABEL, FOX_GROUP_ORDER, groupCounts } from '@/lib/fox-status';
import { REVEAL_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import FoxChip from './FoxChip';
import FoxStatusBar from './FoxStatusBar';
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

/** "Vossen" card (mockup C2): status bar, count legend, one tonal block per non-empty group with area chips. */
export default function FoxesCard() {
  const foxes = useSidebarFoxes();
  const { toggleHidden, isHidden } = useAreas();
  const { isForbidden } = useHuntableAreas();
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
  return (
    <div className="flex flex-col">
      <FoxStatusBar foxes={foxes} size="full" isForbidden={isForbidden} />
      <div className="mt-1.5 mb-2.5 flex justify-between text-[11px] text-muted-foreground">
        {FOX_GROUP_ORDER.map((group) => (
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
              <div className={cn('rounded-2xl px-2 pt-[7px] pb-2 transition-colors duration-300 motion-reduce:transition-none', GROUP_CLASS[group].block, GROUP_CLASS[group].on)}>
                <div className="mx-0.5 mb-1.5 flex justify-between text-xs font-bold">
                  <span>{FOX_GROUP_LABEL[group]}</span>
                  <Count value={counts[group]} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {/* popLayout: a chip popping out leaves the flow at once, so its neighbours close the gap */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    {foxes
                      .filter((fox) => fox.group === group)
                      .map((fox) => (
                        <FoxChip key={fox.key} fox={fox} hidden={isHidden(fox.area.name)} forbidden={isForbidden(fox.area.name)} popIn={mounted} onToggle={() => toggleHidden(fox.area.name)} />
                      ))}
                  </AnimatePresence>
                </div>
              </div>
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
      <span className="sr-only">{`${counts.green} actief, ${counts.orange} onderweg, ${counts.cooldown} cooldown, ${counts.red} inactief`}</span>
    </motion.span>
  );
}
