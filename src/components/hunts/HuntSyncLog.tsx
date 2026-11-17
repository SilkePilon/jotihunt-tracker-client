import { memo, useState, type UIEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { formatClock } from '@/lib/format';
import { huntEventParts, huntEventTime } from '@/lib/hunt-sync';
import { Loader2Icon } from 'lucide-react';
import LoadError from '@/components/LoadError';
import { REVEAL_TRANSITION, revealTransition, SWAP } from '@/lib/motion';
import { getColorFromArea } from '@/lib/utils';
import type { HuntSyncEvent } from '@/types/HuntSync';

/** Start fetching older lines when the scroll is this close to the end */
const LOAD_MORE_PX = 48;

interface HuntSyncLogProps {
  events: HuntSyncEvent[];
  onSelect: (event: HuntSyncEvent) => void;
  onLoadMore: () => void;
  /** An older page is on its way: a "Oudere hunts laden…" row at the end */
  loadingMore?: boolean;
  /** Loading an older page failed: a row with a retry at the end */
  pageFailed?: boolean;
  onRetryPage?: () => unknown;
}

/** The sync log (mockup C v3): time, area dot, bold area + what happened; newest first, scrolls for older lines. */
export default function HuntSyncLog({ events, onSelect, onLoadMore, loadingMore = false, pageFailed = false, onRetryPage }: HuntSyncLogProps) {
  const reduced = useReducedMotion() ?? false;
  // Reduced motion: a line takes and gives back its room at once and only fades
  const fold = {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0, transition: revealTransition(reduced, 'exit') },
    transition: revealTransition(reduced, 'enter'),
  };
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
            <motion.li key={event._id} className="overflow-hidden" {...fold}>
              {/* pb-0.5: the 2 px gap between rows, inside the folding height */}
              <div className="pb-0.5">
                <LogRow event={event} onSelect={onSelect} />
              </div>
            </motion.li>
          ))}
          {(loadingMore || pageFailed) && (
            <motion.li key="more" className="overflow-hidden" {...fold}>
              <AnimatePresence mode="wait" initial={false}>
                {pageFailed ? (
                  <motion.div key="failed" className="p-1" {...SWAP}>
                    <LoadError message="Oudere hunts laden is mislukt." onRetry={() => onRetryPage?.()} />
                  </motion.div>
                ) : (
                  <motion.p key="loading" role="status" className="flex items-center justify-center gap-1.5 p-1.5 text-xs text-muted-foreground" {...SWAP}>
                    <Loader2Icon className="size-3.5 animate-spin" />
                    Oudere hunts laden…
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.li>
          )}
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

/**
 * A log line; flies the map to the hunt once its location is known. Without a location (the server places a hunt
 * from our trackers a few minutes after it came in) the row is inert (no hover, default cursor, not focusable) and says
 * "Locatie volgt…". It stays the same element either way: when the location arrives that line folds away, the hover
 * turns on and the row flashes once.
 */
const LogRow = memo(function LogRow({ event, onSelect }: { event: HuntSyncEvent; onSelect: (event: HuntSyncEvent) => void }) {
  const { area, text } = huntEventParts(event);
  const located = event.location !== null;
  // Count the moments the location arrived while this row was on screen (state adjusted during render, not in an effect)
  const [seenLocated, setSeenLocated] = useState(located);
  const [arrivals, setArrivals] = useState(0);
  if (located !== seenLocated) {
    setSeenLocated(located);
    if (located) setArrivals((count) => count + 1);
  }

  return (
    <button
      type="button"
      disabled={!located}
      // At least 44px tall for every pointer (a comfortable target with a mouse too); the event in 14px text, the
      // time column a little wider for its larger tabular digits
      className="relative isolate grid min-h-11 w-full grid-cols-[40px_1fr] items-center gap-x-2 rounded-lg p-1 text-left text-sm transition-colors duration-200 enabled:cursor-pointer enabled:hover:bg-beheer-row focus-visible:bg-beheer-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default"
      onClick={() => onSelect(event)}
      aria-label={located ? `Toon ${area} ${text} op de kaart` : `${area} ${text}, locatie volgt`}
    >
      {arrivals > 0 && (
        <motion.span
          key={arrivals}
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-lg bg-beheer-row-high"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      )}
      <HuntEventLine event={event} />
      {/* Why the row can't be tapped yet; folds away when the location arrives */}
      <AnimatePresence initial={false}>
        {!located && (
          <motion.span
            key="pending"
            className="col-start-2 overflow-hidden text-[11.5px] text-muted-foreground pointer-coarse:text-xs"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={REVEAL_TRANSITION}
          >
            Locatie volgt…
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
});
