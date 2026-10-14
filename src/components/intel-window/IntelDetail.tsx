import type { RefObject } from 'react';
import { motion } from 'motion/react';
import { ClockIcon } from 'lucide-react';
import { Tag } from '@/components/beheer/controls/Pill';
import { MapRef } from '@/components/Map';
import { useNow } from '@/hooks/now.hook';
import { formatClock } from '@/lib/format';
import { DETAIL_PART, deadlineLabel, solvedCount } from '@/lib/intel-window';
import type { IntelItem } from '@/types/Intel';
import AssignmentPane from './AssignmentPane';
import HintPane from './HintPane';
import { KindTag } from './IntelTimeline';
import NewsPane from './NewsPane';
import SummaryCard from './SummaryCard';

interface IntelDetailProps {
  item: IntelItem;
  /** For a hint: the area to unfold first */
  area: string | null;
  /** For "Op kaart" in the hint pane */
  mapRef: RefObject<MapRef | null>;
}

/**
 * The item on the right: title, meta line, summary and the pane for its kind. Every top-level part is a motion element
 * with `DETAIL_PART`, so the keyed `DetailSlide` around it (IntelDialog) pushes them in on open and lets them rise in on a swap.
 */
export default function IntelDetail({ item, area, mapRef }: IntelDetailProps) {
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  return (
    <div className="flex flex-col gap-3">
      <motion.div variants={DETAIL_PART}>
        {/* pr-10 keeps the title clear of the close button */}
        <h2 className="pr-10 text-[21px] leading-tight font-bold">{item.title}</h2>
        <div className="mt-1.5 mb-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          <KindTag kind={item.kind} />
          <span className="tabular-nums">{formatClock(item.publishAt)}</span>
          {count && count.total > 0 && (
            <span className="tabular-nums">
              · {count.solved}/{count.total} opgelost
            </span>
          )}
          {item.kind === 'assignment' && item.endTime && <Deadline endTime={item.endTime} />}
          {item.kind === 'assignment' && item.maxPoints ? <span>max {item.maxPoints} pt</span> : null}
        </div>
      </motion.div>
      {item.summary && (
        <motion.div variants={DETAIL_PART}>
          <SummaryCard summary={item.summary} />
        </motion.div>
      )}
      {item.kind === 'assignment' ? (
        <AssignmentPane item={item} />
      ) : item.kind === 'news' ? (
        <NewsPane item={item} />
      ) : (
        <HintPane item={item} area={area} mapRef={mapRef} />
      )}
    </div>
  );
}

/** "nog 42 min" in amber; ticks on its own so the rest of the header doesn't re-render every second */
function Deadline({ endTime }: { endTime: string }) {
  const now = useNow(true);
  return (
    <Tag tone="warn">
      <ClockIcon />
      {deadlineLabel(endTime, now)}
    </Tag>
  );
}
