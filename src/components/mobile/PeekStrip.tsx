import { useNow } from '@/hooks/now.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { trackerPeekLine } from '@/lib/tracker';
import { cookiePath, BADGE_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { useSidebarFoxes } from '@/components/sidebar/foxes/useSidebarFoxes';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import FoxStatusBar from '@/components/sidebar/foxes/FoxStatusBar';
import { FOX_GROUP_LABEL, groupCounts, legendGroups } from '@/lib/fox-status';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreas } from '@/hooks/areas.hook';
import { SWAP_TRANSITION } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { tourTarget } from '@/components/tour/targets';

const COOKIE_16 = cookiePath(16, BADGE_COOKIE_DEPTH);
const TONE_FILL = { ok: 'var(--status-ok-dot)', warn: 'var(--status-warn-dot)', muted: 'var(--muted-foreground)' } as const;

/** Own tracker line; ticks every second for the age, on its own so the fox bar does not re-render with it. */
function TrackerLine({ onOpen }: { onOpen: () => void }) {
  const { status, isError } = useTrackerStatus();
  const now = useNow(true);
  // A failed first load says so; the tap opens the tracker page, whose LoadError retries
  const line = trackerPeekLine(status, now, isError);
  return (
    <button type="button" onClick={onOpen} className={cn('flex min-h-9 items-center gap-2 text-left text-[13.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset rounded-md', COARSE_HIT_AREA)}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <path d={COOKIE_16} fill={TONE_FILL[line.tone]} />
      </svg>
      <span className={cn('truncate font-semibold tabular-nums', line.tone === 'warn' && 'text-status-warn-text')}>{line.text}</span>
    </button>
  );
}

/**
 * Always-visible top of the phone sheet: own tracker line + Vossen status bar with legend. The fox part always takes
 * the bar's height (h-8: 10px bar + 6px gap + 16px legend), loading or empty too, so the peek (and the map above it)
 * doesn't shift when the areas come in.
 */
export default function PeekStrip() {
  const foxes = useSidebarFoxes();
  const { isError } = useAreas();
  const { isForbidden } = useHuntableAreas();
  const push = useMobileNavStore((s) => s.push);
  const counts = foxes ? groupCounts(foxes) : undefined;
  const scene = foxes && foxes.length > 0 ? 'bar' : foxes ? 'empty' : isError ? 'error' : 'loading';

  return (
    // isolate: the buttons' 44px touch areas (COARSE_HIT_AREA) stay above the sheet's background
    <div {...tourTarget('mobile.peek')} className="isolate flex flex-col gap-2 pr-[max(1rem,env(safe-area-inset-right))] pb-3 pl-[max(1rem,env(safe-area-inset-left))]">
      <TrackerLine onOpen={() => push({ id: 'tracking' })} />
      <div className="relative h-8">
        <AnimatePresence initial={false}>
          <motion.div key={scene} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SWAP_TRANSITION}>
            {scene === 'bar' && foxes && counts ? (
              <button type="button" onClick={() => push({ id: 'foxes' })} className={cn('flex w-full flex-col gap-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset rounded-md', COARSE_HIT_AREA)}>
                <FoxStatusBar foxes={foxes} size="full" isForbidden={isForbidden} />
                {/* The visible counts are part of the button's name; the sr-only prefix says what a tap does */}
                <span className="sr-only">Vossen openen: </span>
                <span className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  {legendGroups(counts).map((group) => (
                    <span key={group}>
                      <b className="font-semibold text-foreground">{counts[group]}</b> {FOX_GROUP_LABEL[group].toLowerCase()}
                    </span>
                  ))}
                </span>
              </button>
            ) : scene === 'loading' ? (
              <div className="flex flex-col gap-1.5" role="status" aria-label="Vossen laden">
                <Skeleton className="h-2.5 w-full rounded-md" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <button type="button" onClick={() => push({ id: 'foxes' })} className={cn('flex h-full w-full items-center text-left text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset rounded-md', COARSE_HIT_AREA)}>
                {scene === 'error' ? 'Vossen niet geladen — tik om te openen' : 'Nog geen vossen'}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
