import { memo } from 'react';
import { othersOnItem } from '@/lib/intel';
import type { IntelItem, PresenceEntry } from '@/types/Intel';
import PresenceBar from './PresenceBar';

interface NewsPaneProps {
  item: IntelItem;
  presence: PresenceEntry[];
  selfId?: string;
}

/** The right pane for a news item: who else reads it and how many have */
function NewsPane({ item, presence, selfId }: NewsPaneProps) {
  // The count is polled; once this user opened the item it is at least them
  const readBy = Math.max(item.readBy, item.unread ? 0 : 1);
  return (
    <div className="flex flex-col gap-3 p-4">
      <PresenceBar entries={othersOnItem(presence, item.id, selfId)} />
      <p className="text-sm text-muted-foreground">
        Gelezen door <span className="tabular-nums">{readBy}</span>
      </p>
      {!item.summary && <p className="text-sm text-muted-foreground">Nog geen samenvatting.</p>}
    </div>
  );
}

export default memo(NewsPane);
