import { motion, useReducedMotion } from 'motion/react';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { othersOnItem } from '@/lib/intel';
import type { IntelItem, PresenceEntry } from '@/types/Intel';
import IntelListItem from './IntelListItem';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

interface IntelListProps {
  items: IntelItem[];
  selectedId?: number;
  now: number;
  presence: PresenceEntry[];
  selfId?: string;
  onSelect: (item: IntelItem) => void;
  loading: boolean;
}

/** The scrolling list of hints, assignments and news, newest first */
export default function IntelList({ items, selectedId, now, presence, selfId, onSelect, loading }: IntelListProps) {
  const reducedMotion = useReducedMotion();
  const animation = reducedMotion ? {} : { layout: true, initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.15 } };

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
    <div role="list" className="min-h-0 flex-1 overflow-y-auto">
      {items.map((item) => (
        <motion.div key={item.id} role="listitem" {...animation}>
          <IntelListItem item={item} selected={item.id === selectedId} now={now} presence={othersOnItem(presence, item.id, selfId)} onSelect={() => onSelect(item)} />
        </motion.div>
      ))}
    </div>
  );
}
