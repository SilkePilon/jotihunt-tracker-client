import { RefObject, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { MapRef } from '@/components/Map';
import FadeText from '@/components/motion/FadeText';
import LoadError from '@/components/LoadError';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import SidebarSection from '@/components/sidebar/SidebarSection';
import CookieBadge from '@/components/tracker/CookieBadge';
import { useHuntEvents, useHuntSync, useSyncedHunts } from '@/hooks/hunt-sync.hook';
import { useMarkers } from '@/hooks/markers.hook';
import { useNow } from '@/hooks/now.hook';
import { HUNT_SYNC_TITLE, huntSyncLine, huntSyncSummary, huntSyncView, type HuntSyncView } from '@/lib/hunt-sync';
import { huntMarkerId } from '@/lib/hunt-marker';
import { activatedByKeyboard } from '@/lib/input-modality';
import { FOX_MARKERS_LAYER } from '@/lib/map-layers';
import { POP, SWAP } from '@/lib/motion';
import { getColorFromArea } from '@/lib/utils';
import useHuntFocusStore from '@/stores/hunt-focus.store';
import useSidebarStore from '@/stores/sidebar.store';
import type { HuntSyncEvent, HuntSyncStatus } from '@/types/HuntSync';
import HuntResultBar from './HuntResultBar';
import HuntSyncLog from './HuntSyncLog';

const BADGE_SIZE = 56;
const GLYPH_SIZE = Math.round(BADGE_SIZE * 0.42);
const FLY_TO_ZOOM = 16;

/** Spinning sync arrows (white), while a scrape runs */
function SyncGlyph() {
  return (
    <svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" className="motion-safe:animate-[spin_1.2s_linear_infinite]">
      <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M18.5 2v4h-4M5.5 22v-4h4" />
    </svg>
  );
}

/** Chain link (muted), no jotihunt.nl login */
function LinkGlyph() {
  return (
    <svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

function SyncBadge({ view }: { view: HuntSyncView }) {
  switch (view) {
    case 'synced':
      return <CookieBadge tone="ok" size={BADGE_SIZE} />;
    case 'syncing':
      return <CookieBadge tone="ok" size={BADGE_SIZE} glyph={<SyncGlyph />} />;
    case 'failing':
      return <CookieBadge tone="warn" size={BADGE_SIZE} />;
    case 'unlinked':
      return <CookieBadge tone="neutral" size={BADGE_SIZE} glyph={<LinkGlyph />} />;
  }
}

interface HuntsSyncViewProps {
  status: HuntSyncStatus;
  events: HuntSyncEvent[] | undefined;
  onSelect: (event: HuntSyncEvent) => void;
  onLoadMore: () => void;
  /** The log's first page failed (nothing to show yet) */
  eventsFailed?: boolean;
  loadingMore?: boolean;
  pageFailed?: boolean;
  onRetryEvents?: () => unknown;
}

/**
 * The card's content (mockup C v3): cookie, title, sync line, result bar and sync log. Stays mounted across the sync
 * states: only the badge pops, the texts fade, and the bar + log fold away while there's no jotihunt.nl login.
 */
export function HuntsSyncView({ status, events, onSelect, onLoadMore, eventsFailed = false, loadingMore, pageFailed, onRetryEvents }: HuntsSyncViewProps) {
  const now = useNow(true);
  const view = huntSyncView(status);
  const linked = view !== 'unlinked';

  return (
    <div data-hunt-sync-state={view}>
      <div className="flex flex-col items-center gap-0.5 pt-1 text-center">
        <div className="grid place-items-center" style={{ width: BADGE_SIZE, height: BADGE_SIZE }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={view} className="col-start-1 row-start-1" {...POP}>
              <SyncBadge view={view} />
            </motion.div>
          </AnimatePresence>
        </div>
        <FadeText swapKey={HUNT_SYNC_TITLE[view]} className="mt-2 text-base font-bold">
          {HUNT_SYNC_TITLE[view]}
        </FadeText>
        <Reveal gap={2}>{view === 'failing' && status.lastError && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{status.lastError}</p>}</Reveal>
        {/* Keyed on the view, so the ticking "… geleden" and the counts don't fade on every poll */}
        <FadeText swapKey={view} className="text-xs text-muted-foreground tabular-nums">
          {huntSyncLine(status, now)}
        </FadeText>
      </div>
      <Reveal>
        {linked && (
          <>
            <HuntResultBar counts={status.counts} />
            <AnimatePresence mode="wait" initial={false}>
              {events !== undefined ? (
                <motion.div key={events.length === 0 ? 'empty' : 'log'} {...SWAP}>
                  <HuntSyncLog events={events} onSelect={onSelect} onLoadMore={onLoadMore} loadingMore={loadingMore} pageFailed={pageFailed} onRetryPage={onRetryEvents} />
                </motion.div>
              ) : eventsFailed ? (
                <motion.div key="failed" className="mt-2.5" {...SWAP}>
                  <LoadError centered message="Het hunt-logboek kon niet worden geladen." onRetry={() => onRetryEvents?.()} />
                </motion.div>
              ) : (
                <motion.div key="loading" className="mt-2.5 flex flex-col gap-1" role="status" aria-label="Logboek laden" {...SWAP}>
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-6 w-full rounded-lg" />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </Reveal>
    </div>
  );
}

/** Stands in for the card while the status loads, at the size of the linked card (badge, title, line, bar, log). */
function HuntsSyncSkeleton() {
  return (
    <div className="flex flex-col items-center gap-0.5 pt-1" role="status" aria-label="Hunts laden">
      <Skeleton className="rounded-full" style={{ width: BADGE_SIZE, height: BADGE_SIZE }} />
      <Skeleton className="mt-2 h-5 w-32" />
      <Skeleton className="mt-1 h-3.5 w-44" />
      <Skeleton className="mt-2.5 h-2.5 w-[150px] rounded-[5px]" />
      <div className="mt-2.5 flex w-full flex-col gap-1">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Sidebar "Hunts": the jotihunt.nl sync status and log; clicking a log line flies the map to that hunt. */
export default function HuntsSyncCard({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { status, isError, retry } = useHuntSync();
  const linked = status?.configured === true;
  const { events, loadMore, isError: eventsFailed, loadingMore, pageFailed, retry: retryEvents } = useHuntEvents(linked);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const showFocus = useHuntFocusStore((state) => state.show);
  const { hunts } = useSyncedHunts();
  const { markers } = useMarkers();

  const flyTo = useCallback(
    (event: HuntSyncEvent) => {
      if (!event.location) return;
      const { lng, lat } = event.location;
      setSheetSnap('peek');
      mapRef.current?.flyTo({ center: [lng, lat], zoom: FLY_TO_ZOOM, duration: 1500 });
      showFocus({ lng, lat, color: getColorFromArea(event.area) });
      // The hunt marker's popup when the map shows one (made from this hunt), as if it was clicked; focused for keyboard users
      const markerId = huntMarkerId(event.huntId, hunts, markers);
      if (markerId) mapRef.current?.openFeature(FOX_MARKERS_LAYER, markerId, { focus: activatedByKeyboard() });
    },
    [mapRef, setSheetSnap, showFocus, hunts, markers],
  );

  return (
    <SidebarSection id="hunts" title="Hunts" summary={huntSyncSummary(status)}>
      <AnimatePresence mode="wait" initial={false}>
        {status ? (
          <motion.div key="status" {...SWAP}>
            <HuntsSyncView
              status={status}
              events={linked ? events : []}
              onSelect={flyTo}
              onLoadMore={loadMore}
              eventsFailed={eventsFailed}
              loadingMore={loadingMore}
              pageFailed={pageFailed}
              onRetryEvents={retryEvents}
            />
          </motion.div>
        ) : isError ? (
          <motion.div key="error" {...SWAP}>
            <LoadError message="Hunt-status ophalen is mislukt." onRetry={retry} />
          </motion.div>
        ) : (
          <motion.div key="loading" {...SWAP}>
            <HuntsSyncSkeleton />
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarSection>
  );
}
