import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import type { IntelItem, PresenceEntry } from '@/types/Intel';
import IntelListItem from './IntelListItem';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];
const NOBODY: PresenceEntry[] = [];

interface IntelListProps {
  items: IntelItem[];
  selectedId?: number;
  now: number;
  presence: PresenceEntry[];
  selfId?: string;
  /** Must keep its identity between renders: the rows are memoised */
  onSelect: (item: IntelItem) => void;
  loading: boolean;
  /** The list could not be fetched and there is nothing to show */
  failed?: boolean;
}

/** The scrolling list of hints, assignments and news, newest first */
export default function IntelList({ items, selectedId, now, presence, selfId, onSelect, loading, failed = false }: IntelListProps) {
  const reducedMotion = useReducedMotion();
  // Rows only measure themselves again when the list itself changes, not on every tick of the page's clock
  const layoutDependency = useMemo(() => items.map((item) => item.id).join(','), [items]);
  const animation = reducedMotion ? {} : { layout: true, layoutDependency, initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.15 } };

  // The others per item, as one array per item that stays the same until the presence list changes
  const othersByItem = useMemo(() => {
    const byItem = new Map<number, PresenceEntry[]>();
    for (const entry of presence) {
      if (entry.userId === selfId) continue;
      const list = byItem.get(entry.itemId);
      if (list) list.push(entry);
      else byItem.set(entry.itemId, [entry]);
    }
    return byItem;
  }, [presence, selfId]);

  if (failed) {
    return (
      <div role="alert" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-6 text-center text-sm">
        <p className="font-medium">De lijst kon niet worden geladen.</p>
        <p className="text-muted-foreground">We proberen het opnieuw.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy="true" aria-label="Laden…">
        {SKELETON_ROWS.map((row) => (
          <div key={row} className="flex gap-2.5 border-b px-3 py-2.5">
            <Skeleton className="size-6.5 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2 py-0.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Empty className="gap-2 p-6 md:p-6">
          <EmptyHeader>
            <EmptyTitle className="text-base">Niets gevonden</EmptyTitle>
            <EmptyDescription>Pas het filter of de zoekterm aan.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    // layoutScroll: the rows' layout animation takes the scroll offset of this container into account
    <motion.div layoutScroll role="list" className="min-h-0 flex-1 overflow-y-auto">
      {items.map((item) => (
        <motion.div key={item.id} role="listitem" {...animation}>
          <IntelListItem
            item={item}
            selected={item.id === selectedId}
            // Only a deadline counts down; the other rows skip the tick
            now={item.type === 'assignment' && item.endTime ? now : undefined}
            presence={othersByItem.get(item.id) ?? NOBODY}
            onSelect={onSelect}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
