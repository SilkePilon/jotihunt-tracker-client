import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { SWRConfig } from 'swr';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import Map from '@/components/Map';
import HqClock from '@/components/hq/HqClock';
import AreaTiles from '@/components/hq/AreaTiles';
import HuntFeed from '@/components/hq/HuntFeed';
import LatestArticle from '@/components/hq/LatestArticle';
import AlertBanner from '@/components/hq/AlertBanner';
import AudioUnlock from '@/components/hq/AudioUnlock';
import DemoReloader from '@/components/DemoReloader';
import { useNotificationFeed } from '@/hooks/notification-feed.hook';
import { useTheme } from '@/hooks/theme.hook';
import { isUnauthorized } from '@/lib/session';
import { useSessionExpired } from '@/hooks/session.hook';
import { pickPrimary, type AppNotification } from '@/lib/notifications';
import type { User } from '@/types/User';

const BANNER_MS = 8000;

/** Admin-only wall display for the HQ TV: map, area tiles, hunts, latest article, loud alerts for everything. */
export default function Hq() {
  const endSession = useSessionExpired();
  // Outside Layout, so it needs its own handler: an expired session sends the TV to the login page
  return (
    <SWRConfig value={{ onError: (error) => isUnauthorized(error) && endSession() }}>
      <DemoReloader />
      <HqScreen onUnauthorized={endSession} />
    </SWRConfig>
  );
}

function HqScreen({ onUnauthorized }: { onUnauthorized: () => void }) {
  const user = useAuthUser<User>();
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [banner, setBanner] = useState<AppNotification | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  useTheme();

  useNotificationFeed({
    respectPreferences: false,
    toasts: false,
    onUnauthorized,
    onPoll: (alerted) => {
      setBanner(pickPrimary(alerted));
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setBanner(null), BANNER_MS);
    },
  });
  useEffect(() => () => clearTimeout(timeout.current), []);

  if (!user?.admin) return <Navigate to="/" replace />;

  return (
    <div className="grid h-dvh w-dvw grid-cols-[65fr_35fr] overflow-hidden bg-background text-foreground">
      <Map className="relative h-full w-full" />
      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-l p-4">
        <HqClock />
        <AreaTiles />
        <HuntFeed />
        <LatestArticle />
      </aside>
      <AlertBanner notification={banner} onDismiss={() => setBanner(null)} />
      {!audioUnlocked && <AudioUnlock onUnlock={() => setAudioUnlocked(true)} />}
    </div>
  );
}
