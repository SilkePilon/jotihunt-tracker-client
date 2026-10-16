import { memo, type UIEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatClock } from '@/lib/format';
import { huntEventParts, huntEventTime } from '@/lib/hunt-sync';
import { REVEAL_TRANSITION } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';
import type { HuntSyncEvent } from '@/types/HuntSync';

/** Start fetching older lines when the scroll is this close to the end */
const LOAD_MORE_PX = 48;

interface HuntSyncLogProps {
  events: HuntSyncEvent[];
  onSelect: (event: HuntSyncEvent) => void;
  onLoadMore: () => void;
}

/** The sync log (mockup C v3): time, area dot, bold area + what happened; newest first, scrolls for older lines. */
export default function HuntSyncLog({ events, onSelect, onLoadMore }: HuntSyncLogProps) {
  function onScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < LOAD_MORE_PX) onLoadMore();
  }

  if (events.length === 0) return <p className="mt-2.5 text-center text-xs text-muted-foreground">Nog geen hunts binnengekomen</p>;

  return (
    <div className="-mx-1 mt-2.5 max-h-[220px] overflow-y-auto px-1" onScroll={onScroll} data-hunt-sync-log>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.li key={event._id} className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
              {/* pb-0.5: the 2 px gap between rows, inside the folding height */}
              <div className="pb-0.5">
                <LogRow event={event} onSelect={onSelect} />
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/** Time, area dot, bold area + what happened (+ points tag); the two grid cells of a log row. */
export function HuntEventLine({ event }: { event: HuntSyncEvent }) {
  const { area, text, points } = huntEventParts(event);
  return (
    <>
      <span className="text-right text-[0.96em] text-muted-foreground tabular-nums">{formatClock(huntEventTime(event))}</span>
      <span className="min-w-0">
        <span className="mr-[5px] inline-block size-2 rounded-full" style={{ background: getColorFromArea(event.area) }} />
        <b className="font-semibold">{area}</b> {text}
        {points && <span className="font-semibold text-green-700 dark:text-green-400"> {points}</span>}
      </span>
    </>
  );
}

const LogRow = memo(function LogRow({ event, onSelect }: { event: HuntSyncEvent; onSelect: (event: HuntSyncEvent) => void }) {
  const { area, text } = huntEventParts(event);
  const rowClass = 'grid w-full grid-cols-[36px_1fr] items-center gap-2 rounded-lg p-1 text-left text-[12.5px]';

  if (event.location === null) {
    return (
      <div className={rowClass}>
        <HuntEventLine event={event} />
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cn(rowClass, 'cursor-pointer transition-colors hover:bg-beheer-row focus-visible:bg-beheer-row focus-visible:outline-none')}
      onClick={() => onSelect(event)}
      aria-label={`Toon ${area} ${text} op de kaart`}
    >
      <HuntEventLine event={event} />
    </button>
  );
});
