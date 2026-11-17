import type { RefObject } from 'react';
import { MapRef } from '@/components/Map';
import { useNow } from '@/hooks/now.hook';
import { PANE_TITLE } from '@/lib/dialog-shell';
import { formatClock } from '@/lib/format';
import { earnedPoints, solvedCount } from '@/lib/intel-window';
import type { AssignmentStatus, IntelItem } from '@/types/Intel';
import AssignmentPane from './AssignmentPane';
import HintPane from './HintPane';
import { AssignmentStatusTag, DeadlineTag, KindTag } from './IntelTimeline';
import NewsPane from './NewsPane';
import SummaryCard from './SummaryCard';

interface IntelDetailProps {
  item: IntelItem;
  /** For a hint: the area to unfold first */
  area: string | null;
  /** For "Op kaart" in the hint pane */
  mapRef: RefObject<MapRef | null>;
}

/** The open item: a header card (title + meta line), summary and the pane for its kind. */
export default function IntelDetail({ item, area, mapRef }: IntelDetailProps) {
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl bg-card px-6 pt-5 pb-[18px]">
        {/* Takes focus when the item pushes in (IntelDialog), so keyboard users land on what they opened; no ring for that */}
        <h2 tabIndex={-1} data-view-focus className={`${PANE_TITLE} outline-none`}>
          {item.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <KindTag kind={item.kind} />
          <span className="tabular-nums">{formatClock(item.publishAt)}</span>
          {count && count.total > 0 && (
            <span className="tabular-nums">
              · {count.solved}/{count.total} opgelost
            </span>
          )}
          {item.kind === 'assignment' && item.endTime && <Deadline endTime={item.endTime} status={item.assignment?.status ?? 'open'} />}
          {item.kind === 'assignment' && <AssignmentStatusTag item={item} />}
          {item.kind === 'assignment' && item.maxPoints ? <span>{earnedPoints(item.assignment) === null ? `max ${item.maxPoints} pt` : `van max ${item.maxPoints} pt`}</span> : null}
        </div>
      </div>
      {item.summary && <SummaryCard summary={item.summary} />}
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
