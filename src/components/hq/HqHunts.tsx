import { AnimatePresence, motion } from 'motion/react';
import { HuntEventLine } from '@/components/hunts/HuntSyncLog';
import LoadError from '@/components/LoadError';
import { Skeleton } from '@/components/ui/skeleton';
import { loadState } from '@/lib/load-state';
import { REVEAL_TRANSITION, SWAP } from '@/lib/motion';
import type { HuntSyncEvent } from '@/types/HuntSync';

const FEED_SIZE = 3;

/** The newest lines of the jotihunt.nl sync log; a new one slides in at the top. */
export default function HqHunts({ events, isError, onRetry }: { events: HuntSyncEvent[] | undefined; isError: boolean; onRetry: () => Promise<unknown> | unknown }) {
  const latest = (events ?? []).slice(0, FEED_SIZE);
  const view = loadState(events, isError);

  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card px-3.5 pb-3 pt-2.5 text-card-foreground">
      <header className="mb-1 flex items-center justify-between">
        <span className="font-semibold">Hunts</span>
        <span className="text-sm text-muted-foreground">laatste {FEED_SIZE}</span>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' ? (
          <motion.div key="loading" {...SWAP} className="flex flex-col gap-2 py-1" role="status" aria-label="Hunts laden">
            {Array.from({ length: FEED_SIZE }, (_, index) => (
              <Skeleton key={index} className="h-7 w-full" />
            ))}
          </motion.div>
        ) : view === 'error' ? (
          <motion.div key="error" {...SWAP} className="py-1">
            <LoadError message="Hunts konden niet worden geladen." onRetry={onRetry} className="text-base" />
          </motion.div>
        ) : latest.length === 0 ? (
          <motion.p key="empty" {...SWAP} className="text-muted-foreground">
            Nog geen hunts.
          </motion.p>
        ) : (
          <motion.ul key="list" {...SWAP} className="flex flex-col">
            <AnimatePresence initial={false}>
              {latest.map((event) => (
                <motion.li key={event._id} className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
                  <div className="grid grid-cols-[3.2rem_1fr] items-center gap-2 py-1 text-lg">
                    <HuntEventLine event={event} />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}
