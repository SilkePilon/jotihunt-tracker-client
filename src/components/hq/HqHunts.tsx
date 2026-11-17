import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { HuntEventLine } from '@/components/hunts/HuntSyncLog';
import LoadError from '@/components/LoadError';
import { Skeleton } from '@/components/ui/skeleton';
import { HQ_FEED_MIN, hqFeedSize } from '@/lib/hq';
import { loadState } from '@/lib/load-state';
import { revealTransition, SWAP } from '@/lib/motion';
import type { HuntSyncEvent } from '@/types/HuntSync';

/** A one-line row before one is on screen to measure: text-lg's 1.75rem line + py-1 (rem, so it follows the wall's root size) */
const ROW_REM = 2.25;

/**
 * As many lines as fit the card's height (whole rows, at least three), measured as the wall's layout and root font size
 * change. Returns the ref for the area under the header.
 */
function useFeedSize() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(HQ_FEED_MIN);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      // The inner row, not the <li>: that one's height animates while a new line slides in
      const row = body.querySelector<HTMLElement>('[data-hq-row]');
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setSize(hqFeedSize(body.clientHeight, row?.offsetHeight || ROW_REM * rem));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);
  return { bodyRef, size };
}

/** The newest lines of the jotihunt.nl sync log, as many as fit the card; a new one slides in at the top. */
export default function HqHunts({ events, isError, onRetry }: { events: HuntSyncEvent[] | undefined; isError: boolean; onRetry: () => Promise<unknown> | unknown }) {
  const reduced = useReducedMotion() ?? false;
  const { bodyRef, size } = useFeedSize();
  const latest = (events ?? []).slice(0, size);
  const view = loadState(events, isError);

  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card px-3.5 pb-3 pt-2.5 text-card-foreground">
      <header className="mb-1 flex items-center justify-between">
        <span className="font-semibold">Hunts</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          laatste{' '}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={size} {...SWAP} className="inline-block">
              {size}
            </motion.span>
          </AnimatePresence>
        </span>
      </header>
      {/* Fills the rest of the card: its height decides how many lines show (the card clips a line that wraps) */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {view === 'loading' ? (
            <motion.div key="loading" {...SWAP} className="flex flex-col gap-2 py-1" role="status" aria-label="Hunts laden">
              {Array.from({ length: size }, (_, index) => (
                <Skeleton key={index} className="h-7 w-full" />
              ))}
            </motion.div>
          ) : view === 'error' ? (
            <motion.div key="error" {...SWAP} className="py-1">
              <LoadError message="Hunts konden niet worden geladen." onRetry={onRetry} scale className="text-base" />
            </motion.div>
          ) : latest.length === 0 ? (
            <motion.p key="empty" {...SWAP} className="text-muted-foreground">
              Nog geen hunts.
            </motion.p>
          ) : (
            <motion.ul key="list" {...SWAP} className="flex flex-col">
              <AnimatePresence initial={false}>
                {latest.map((event) => (
                  <motion.li key={event._id} className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0, transition: revealTransition(reduced, 'exit') }} transition={revealTransition(reduced, 'enter')}>
                    <div data-hq-row className="grid grid-cols-[3.2rem_1fr] items-center gap-2 py-1 text-lg">
                      <HuntEventLine event={event} />
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
