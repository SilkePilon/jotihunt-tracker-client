import type { RefObject } from 'react';
import { motion } from 'motion/react';
import { MapRef } from '@/components/Map';
import { useNow } from '@/hooks/now.hook';
import { formatClock } from '@/lib/format';
import { DETAIL_HEAD, DETAIL_PART, INTEL_MORPH, solvedCount } from '@/lib/intel-window';
import type { AssignmentStatus, IntelItem } from '@/types/Intel';
import AssignmentPane from './AssignmentPane';
import HintPane from './HintPane';
import { DeadlineTag, KindTag } from './IntelTimeline';
import { useMorphIds } from './morph';
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
 * The open item: a header card (title + meta line), summary and the pane for its kind. The header's frame and title share
 * a `layoutId` with the timeline card (IntelTimeline), so the card morphs into it. The header uses `DETAIL_HEAD`, every
 * other top-level part is a motion element with `DETAIL_PART`, so the keyed `DetailSlide` around it (IntelDialog) staggers
 * them in after the morph, or lets them rise in on a swap.
 */
export default function IntelDetail({ item, area, mapRef }: IntelDetailProps) {
  const morph = useMorphIds(item.id);
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  return (
    <div className="flex flex-col gap-3">
      <motion.div variants={DETAIL_HEAD} className="relative">
        <motion.div
          layoutId={morph.card}
          layoutCrossfade={false}
          transition={INTEL_MORPH}
          style={{ borderRadius: 20 }}
          className="absolute inset-0 bg-card"
          aria-hidden
        />
        <div className="relative px-6 pt-5 pb-[18px]">
          {/* Title and meta move as one (position only, never scaled) from the card's title, crossfading with it */}
          <motion.div layoutId={morph.title} layout="position" transition={INTEL_MORPH}>
            <h2 className="text-[21px] leading-tight font-bold">{item.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
              <KindTag kind={item.kind} />
              <span className="tabular-nums">{formatClock(item.publishAt)}</span>
              {count && count.total > 0 && (
                <span className="tabular-nums">
                  · {count.solved}/{count.total} opgelost
                </span>
              )}
              {item.kind === 'assignment' && item.endTime && <Deadline endTime={item.endTime} status={item.assignment?.status ?? 'open'} />}
              {item.kind === 'assignment' && item.maxPoints ? <span>max {item.maxPoints} pt</span> : null}
            </div>
          </motion.div>
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

/** The deadline pill; ticks on its own so the rest of the header doesn't re-render every second */
function Deadline({ endTime, status }: { endTime: string; status: AssignmentStatus }) {
  const now = useNow(true);
  return <DeadlineTag endTime={endTime} now={now} status={status} />;
}
