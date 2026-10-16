import { AnimatePresence, motion } from 'motion/react';
import { HuntEventLine } from '@/components/hunts/HuntSyncLog';
import { REVEAL_TRANSITION } from '@/lib/motion';
import type { HuntSyncEvent } from '@/types/HuntSync';

const FEED_SIZE = 3;

/** The newest lines of the jotihunt.nl sync log; a new one slides in at the top. */
export default function HqHunts({ events }: { events: HuntSyncEvent[] | undefined }) {
  const latest = (events ?? []).slice(0, FEED_SIZE);

  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card px-3.5 pb-3 pt-2.5 text-card-foreground">
      <header className="mb-1 flex items-center justify-between">
        <span className="font-semibold">Hunts</span>
        <span className="text-sm text-muted-foreground">laatste {FEED_SIZE}</span>
      </header>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {latest.map((event) => (
            <motion.li key={event._id} className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
              <div className="grid grid-cols-[3.2rem_1fr] items-center gap-2 py-1 text-lg">
                <HuntEventLine event={event} />
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {events?.length === 0 && <p className="text-muted-foreground">Nog geen hunts.</p>}
    </section>
  );
}
