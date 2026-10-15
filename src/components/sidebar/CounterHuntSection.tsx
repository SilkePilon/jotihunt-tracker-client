import { RefObject, useEffect } from 'react';
import { destination } from '@turf/turf';
import CounterHuntCard from '@/components/cards/counter-hunt/CounterHuntCard';
import type { MapRef } from '@/components/Map';
import { useCounterHunt } from '@/hooks/counter-hunt.hook';
import { useTelegramMessages } from '@/hooks/telegram.hook';
import { useHomeTeam } from '@/hooks/teams.hook';
import { counterHuntSummary } from '@/lib/counter-hunt';
import type { User } from '@/types/User';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { cn } from '@/lib/utils';
import useSidebarStore from '@/stores/sidebar.store';
import SidebarSection from './SidebarSection';

/** Middle of the 500 m wind sector (see HomeCircle). */
const SECTOR_CENTRE_M = 250;


/**
 * "Tegenhunt": the server's latest tegenhunt. Opened once per tegenhunt (also across reloads) and left open when it
 * ends; the user collapses it (persisted like the other sections).
 */
export default function CounterHuntSection({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { state, now } = useCounterHunt();
  const { link } = useTelegramMessages();
  const user = useAuthUser<User>();
  const homeTeam = useHomeTeam();
  const open = useSidebarStore((store) => store.openSections.counterHunt);
  const setSectionOpen = useSidebarStore((store) => store.setSectionOpen);
  const openOnceFor = useSidebarStore((store) => store.openOnceFor);
  const setSheetSnap = useSidebarStore((store) => store.setSheetSnap);

  const active = state?.kind === 'active';
  const activeSince = state?.kind === 'active' ? state.startedAt : undefined;
  useEffect(() => {
    if (activeSince) openOnceFor('counterHunt', activeSince);
  }, [activeSince, openOnceFor]);

  const direction = state?.kind === 'active' ? state.direction : null;
  function showOnMap() {
    if (!homeTeam || direction === null) return;
    const [longitude, latitude] = destination(homeTeam.location.coordinates, SECTOR_CENTRE_M, direction, { units: 'meters' }).geometry.coordinates;
    setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [longitude, latitude], duration: 2000, zoom: 16 });
  }

  const summary = counterHuntSummary(state, link, now);

  return (
    <SidebarSection
      id="counterHunt"
      title="Tegenhunt"
      summary={summary?.text}
      open={open}
      onOpenChange={(next) => setSectionOpen('counterHunt', next)}
      className={cn(active && 'bg-linear-160 from-red-500/18 to-red-500/4 outline outline-red-500/30')}
    >
      <CounterHuntCard state={state} link={link} admin={!!user?.admin} now={now} onShowOnMap={homeTeam && direction !== null ? showOnMap : undefined} />
    </SidebarSection>
  );
}
