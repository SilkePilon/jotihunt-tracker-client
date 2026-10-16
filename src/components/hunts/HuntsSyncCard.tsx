import { RefObject, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { MapRef } from '@/components/Map';
import FadeText from '@/components/motion/FadeText';
import Reveal from '@/components/motion/Reveal';
import SidebarSection from '@/components/sidebar/SidebarSection';
import CookieBadge from '@/components/tracker/CookieBadge';
import { useHuntEvents, useHuntSync } from '@/hooks/hunt-sync.hook';
import { useNow } from '@/hooks/now.hook';
import { HUNT_SYNC_TITLE, huntSyncLine, huntSyncSummary, huntSyncView, type HuntSyncView } from '@/lib/hunt-sync';
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
}

/**
 * The card's content (mockup C v3): cookie, title, sync line, result bar and sync log. Stays mounted across the sync
 * states: only the badge pops, the texts fade, and the bar + log fold away while there's no jotihunt.nl login.
 */
export function HuntsSyncView({ status, events, onSelect, onLoadMore }: HuntsSyncViewProps) {
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
            {events !== undefined && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={events.length === 0 ? 'empty' : 'log'} {...SWAP}>
                  <HuntSyncLog events={events} onSelect={onSelect} onLoadMore={onLoadMore} />
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}
      </Reveal>
    </div>
  );
}

/** Sidebar "Hunts": the jotihunt.nl sync status and log; clicking a log line flies the map to that hunt. */
export default function HuntsSyncCard({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { status, isError } = useHuntSync();
  const linked = status?.configured === true;
  const { events, loadMore } = useHuntEvents(linked);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const showFocus = useHuntFocusStore((state) => state.show);

  const flyTo = useCallback(
    (event: HuntSyncEvent) => {
      if (!event.location) return;
      const { lng, lat } = event.location;
      setSheetSnap('peek');
      mapRef.current?.flyTo({ center: [lng, lat], zoom: FLY_TO_ZOOM, duration: 1500, essential: true });
      showFocus({ lng, lat, color: getColorFromArea(event.area) });
    },
    [mapRef, setSheetSnap, showFocus],
  );

  return (
    <SidebarSection id="hunts" title="Hunts" summary={huntSyncSummary(status)}>
      {status ? (
        <HuntsSyncView status={status} events={linked ? events : []} onSelect={flyTo} onLoadMore={loadMore} />
      ) : (
        isError && <p className="text-xs text-muted-foreground">Hunt-status ophalen is mislukt.</p>
      )}
    </SidebarSection>
  );
}
