import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { SWRConfig } from 'swr';
import { AnimatePresence } from 'motion/react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import Map, { type MapRef } from '@/components/Map';
import AudioUnlock, { AudioUnlockTile } from '@/components/hq/AudioUnlock';
import FocusPulse from '@/components/hq/FocusPulse';
import FoxBoard from '@/components/hq/FoxBoard';
import HqEventCard from '@/components/hq/HqEventCard';
import HqHunts from '@/components/hq/HqHunts';
import HqTopCard from '@/components/hq/HqTopCard';
import TourChip from '@/components/hq/TourChip';
import EditionReloader from '@/components/EditionReloader';
import ErrorBoundary from '@/components/ErrorBoundary';
import StaleDataBadge from '@/components/StaleDataBadge';
import { useAreas } from '@/hooks/areas.hook';
import { useHqDirector } from '@/hooks/hq-director.hook';
import { useHqEventSources } from '@/hooks/hq-events.hook';
import { useIdleCursor } from '@/hooks/idle-cursor.hook';
import { useHuntEvents, useSyncedHunts } from '@/hooks/hunt-sync.hook';
import { useNotificationFeed } from '@/hooks/notification-feed.hook';
import { useNow } from '@/hooks/now.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { useSessionExpired } from '@/hooks/session.hook';
import { isHomeTeam, useTeams } from '@/hooks/teams.hook';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useTheme } from '@/hooks/theme.hook';
import { type AudioPermission, hqUnlockMode, probeAudio, readUnlockFlag, writeUnlockFlag } from '@/lib/hq-unlock';
import { buildFoxes, eventFromNotification, type HqEvent } from '@/lib/hq-director';
import { loadState } from '@/lib/load-state';
import { isUnauthorized } from '@/lib/session';
import { getColorFromArea } from '@/lib/utils';
import { createWakeLock } from '@/lib/wake-lock';
import useHqDirectorStore from '@/stores/hq-director.store';
import type { User } from '@/types/User';

/**
 * Everything on the screen is sized in rem: scale the root font with the screen width, so 1080p and a beamer look alike.
 * The rem part (the browser's own font size, inside html's font-size) keeps browser zoom and a larger default font
 * working; pure vw ignored both. 1920 px wide: 19.2 + 4.8 = 24 px (was 1.3vw = 25 px).
 */
const WALL_FONT_SIZE = 'calc(1vw + 0.3rem)';

/** The cursor hides after this long without a mouse move */
const CURSOR_IDLE_MS = 3000;

/** Admin-only wall display for the HQ beamer: a map that tours the active foxes and flies to events, plus the fox board. */
export default function Hq() {
  const endSession = useSessionExpired();
  // Outside Layout, so it needs its own handler: an expired session sends the TV to the login page
  return (
    <SWRConfig value={{ onError: (error) => isUnauthorized(error) && endSession() }}>
      <EditionReloader />
      {/* Centred over the map column, not the whole screen */}
      <StaleDataBadge wall />
      <HqScreen onUnauthorized={endSession} />
    </SWRConfig>
  );
}

function HqScreen({ onUnauthorized }: { onUnauthorized: () => void }) {
  const user = useAuthUser<User>();
  // Sound needs one click per page load. The click is remembered for this tab (sessionStorage), so after a reload
  // (an automatic update, an edition switch) the wall carries on: only when the browser blocks sound again does a small
  // corner tile ask for a new click; the full overlay is for the very first visit.
  const [unlockFlag, setUnlockFlag] = useState(readUnlockFlag);
  // Checked once on load (synchronous): only matters when the tab was unlocked before
  const [audio, setAudio] = useState<AudioPermission>(() => (unlockFlag ? probeAudio() : 'unknown'));
  const mode = hqUnlockMode(unlockFlag, audio);
  // The beamer must never dim or sleep: a screen wake lock from the unlock click on (a user activation, which some
  // browsers want), or at once after a reload in a tab that was unlocked before (no gesture needed while visible);
  // requested again whenever the page is shown again (createWakeLock), let go when leaving the wall
  const [wakeLock] = useState(createWakeLock);
  useEffect(() => () => wakeLock.stop(), [wakeLock]);
  useEffect(() => {
    if (unlockFlag) wakeLock.start();
  }, [unlockFlag, wakeLock]);
  const unlock = useCallback(() => {
    writeUnlockFlag();
    wakeLock.start();
    setUnlockFlag(true);
    setAudio('allowed');
  }, [wakeLock]);
  // Tile shown: any click or key on the wall turns sound on too (it is a user activation all the same)
  useEffect(() => {
    if (mode !== 'tile') return;
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [mode, unlock]);
  // Video-player cursor: shown while the mouse moves, hidden after 3 s without (data-idle), so nobody's pointer stays
  // parked on top of the map or the board
  const idle = useIdleCursor(CURSOR_IDLE_MS);
  const mapRef = useRef<MapRef>(null);
  const push = useHqDirectorStore((state) => state.push);
  useTheme();

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.fontSize;
    html.style.fontSize = WALL_FONT_SIZE;
    return () => {
      html.style.fontSize = previous;
    };
  }, []);

  useNotificationFeed({
    respectPreferences: false,
    toasts: false,
    onUnauthorized,
    onPoll: (alerted) => push(alerted.map(eventFromNotification).filter((event): event is HqEvent => event !== null)),
  });

  const now = useNow(true);
  const { areas, isError: areasError, retry: retryAreas } = useAreas();
  // A failed later poll keeps the last areas on screen (the stale badge says so)
  const areasState = loadState(areas, areasError);
  const { hunts } = useSyncedHunts();
  const { events, isError: eventsError, retry: retryEvents } = useHuntEvents();
  const { predictions } = usePredictions();
  const { teams } = useTeams();
  useAppConfig(); // re-render when the home team is configured
  const homeTeam = teams?.find(isHomeTeam);
  const foxes = useMemo(() => buildFoxes({ areas, hunts, predictions, teams, now }), [areas, hunts, predictions, teams, now]);
  useHqEventSources(foxes, events);
  const director = useHqDirector({ mapRef, foxes, teams, homeTeam });
  const focusFox = foxes.find((fox) => fox.key === director.focusArea);
  // Keyed on the values, not the fox (rebuilt every second): an unchanged overlay lets the memoized map skip re-rendering
  const focusKey = focusFox?.center ? focusFox.key : undefined;
  const [focusLng, focusLat] = focusFox?.center ?? [];
  const mapOverlay = useMemo(
    () => (focusKey !== undefined && focusLng !== undefined && focusLat !== undefined ? <FocusPulse center={[focusLng, focusLat]} color={getColorFromArea(focusKey)} /> : null),
    [focusKey, focusLng, focusLat],
  );

  if (!user?.admin) return <Navigate to="/" replace />;

  return (
    <main
      data-idle={(idle && mode !== 'overlay') || undefined}
      className="grid h-dvh w-dvw grid-cols-[58fr_42fr] overflow-hidden bg-beheer-window text-foreground data-idle:cursor-none data-idle:[&_*]:cursor-none"
    >
      {/* sr-only (absolutely positioned): not a grid item */}
      <h1 className="sr-only">HQ-scherm</h1>
      <div className="relative min-h-0 overflow-hidden rounded-r-2xl">
        <ErrorBoundary name="De kaart" className="m-auto w-fit">
          <Map ref={mapRef} wall className="absolute inset-0" overlay={mapOverlay} />
        </ErrorBoundary>
        <ErrorBoundary name="De tourchip" className="absolute left-4 top-4 z-10">
          <TourChip stop={director.stop} index={director.stopIndex} count={director.stopCount} step={director.step} hidden={!!director.current} />
        </ErrorBoundary>
        <ErrorBoundary name="De melding" className="absolute inset-x-4 bottom-4 z-10">
          <HqEventCard event={director.current} queued={director.queued} step={director.step} holdMs={director.holdMs} />
        </ErrorBoundary>
        <AnimatePresence>{mode === 'tile' && <AudioUnlockTile key="audio-tile" onUnlock={unlock} />}</AnimatePresence>
      </div>
      <aside className="flex min-h-0 flex-col gap-2 p-3">
        <ErrorBoundary>
          <HqTopCard now={now} />
        </ErrorBoundary>
        <ErrorBoundary>
          <FoxBoard foxes={foxes} focusArea={director.focusArea} state={areasState} onRetry={retryAreas} />
        </ErrorBoundary>
        <ErrorBoundary>
          <HqHunts events={events} isError={eventsError} onRetry={retryEvents} />
        </ErrorBoundary>
      </aside>
      <AnimatePresence>{mode === 'overlay' && <AudioUnlock key="audio" onUnlock={unlock} />}</AnimatePresence>
    </main>
  );
}
