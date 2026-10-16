import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { SWRConfig } from 'swr';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import Map, { type MapRef } from '@/components/Map';
import AudioUnlock from '@/components/hq/AudioUnlock';
import FocusPulse from '@/components/hq/FocusPulse';
import FoxBoard from '@/components/hq/FoxBoard';
import HqEventCard from '@/components/hq/HqEventCard';
import HqHunts from '@/components/hq/HqHunts';
import HqTopCard from '@/components/hq/HqTopCard';
import TourChip from '@/components/hq/TourChip';
import DemoReloader from '@/components/DemoReloader';
import ErrorBoundary from '@/components/ErrorBoundary';
import StaleDataBadge from '@/components/StaleDataBadge';
import { useAreas } from '@/hooks/areas.hook';
import { useHqDirector } from '@/hooks/hq-director.hook';
import { useHqEventSources } from '@/hooks/hq-events.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useNotificationFeed } from '@/hooks/notification-feed.hook';
import { useNow } from '@/hooks/now.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { useSessionExpired } from '@/hooks/session.hook';
import { isHomeTeam, useTeams } from '@/hooks/teams.hook';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useTheme } from '@/hooks/theme.hook';
import { buildFoxes, eventFromNotification, type HqEvent } from '@/lib/hq-director';
import { isUnauthorized } from '@/lib/session';
import { getColorFromArea } from '@/lib/utils';
import useHqDirectorStore from '@/stores/hq-director.store';
import type { User } from '@/types/User';

/** Everything on the screen is sized in rem: scale the root font with the screen width, so 1080p and a beamer look alike. */
const WALL_FONT_SIZE = '1.3vw';

/** Admin-only wall display for the HQ beamer: a map that tours the active foxes and flies to events, plus the fox board. */
export default function Hq() {
  const endSession = useSessionExpired();
  // Outside Layout, so it needs its own handler: an expired session sends the TV to the login page
  return (
    <SWRConfig value={{ onError: (error) => isUnauthorized(error) && endSession() }}>
      <DemoReloader />
      <StaleDataBadge />
      <HqScreen onUnauthorized={endSession} />
    </SWRConfig>
  );
}

function HqScreen({ onUnauthorized }: { onUnauthorized: () => void }) {
  const user = useAuthUser<User>();
  const [audioUnlocked, setAudioUnlocked] = useState(false);
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
  const { areas } = useAreas();
  const { hunts } = useHunts();
  const { reports } = useHuntReports();
  const { predictions } = usePredictions();
  const { teams } = useTeams();
  useAppConfig(); // re-render when the home team is configured
  const homeTeam = teams?.find(isHomeTeam);
  const foxes = useMemo(() => buildFoxes({ areas, hunts, reports, predictions, teams, now }), [areas, hunts, reports, predictions, teams, now]);
  useHqEventSources(foxes, reports);
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
    <div className="grid h-dvh w-dvw grid-cols-[58fr_42fr] overflow-hidden bg-background text-foreground">
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
      </div>
      <aside className="flex min-h-0 flex-col gap-2 p-3">
        <ErrorBoundary>
          <HqTopCard now={now} />
        </ErrorBoundary>
        <ErrorBoundary>
          <FoxBoard foxes={foxes} focusArea={director.focusArea} />
        </ErrorBoundary>
        <ErrorBoundary>
          <HqHunts now={now} />
        </ErrorBoundary>
      </aside>
      {!audioUnlocked && <AudioUnlock onUnlock={() => setAudioUnlocked(true)} />}
    </div>
  );
}
