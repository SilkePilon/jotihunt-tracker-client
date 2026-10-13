import { RefObject, useState } from 'react';
import { destination } from '@turf/turf';
import CounterHuntCard from '@/components/cards/counter-hunt/CounterHuntCard';
import type { MapRef } from '@/components/Map';
import { useCounterHunt } from '@/hooks/counter-hunt.hook';
import { useTelegramMessages } from '@/hooks/telegram.hook';
import { useHomeTeam } from '@/hooks/teams.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { counterHuntState, counterHuntSummary } from '@/lib/counter-hunt';
import { cn } from '@/lib/utils';
import useSidebarStore from '@/stores/sidebar.store';
import SidebarSection from './SidebarSection';

/** Middle of the 500 m wind sector (see HomeCircle). */
const SECTOR_CENTRE_M = 250;

const SUMMARY_TONE = { danger: 'font-medium text-red-600 dark:text-red-400', warn: 'font-medium text-amber-600 dark:text-amber-400' } as const;

/**
 * "Tegenhunt": the server's latest tegenhunt. Forced open when one becomes active and left open when it ends; the user
 * collapses it (persisted like the other sections).
 */
export default function CounterHuntSection({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { view } = useCounterHunt();
  const { linked } = useTelegramMessages();
  const homeTeam = useHomeTeam();
  const storedOpen = useSidebarStore((state) => state.openSections.counterHunt);
  const setSectionOpen = useSidebarStore((state) => state.setSectionOpen);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);

  // Minutes left tick while the server reports an active tegenhunt (also to notice its end before the next poll)
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), view?.active ? 1000 : null);

  const state = counterHuntState(view, now);
  const active = state?.kind === 'active';

  // Adjust the open state during render when a tegenhunt starts (no effect, no ref)
  const [prevActive, setPrevActive] = useState(false);
  const [forcedOpen, setForcedOpen] = useState<boolean | null>(null);
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setForcedOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setForcedOpen(null);
    setSectionOpen('counterHunt', open);
  }

  const direction = state?.kind === 'active' ? state.direction : null;
  function showOnMap() {
    if (!homeTeam || direction === null) return;
    const [longitude, latitude] = destination(homeTeam.location.coordinates, SECTOR_CENTRE_M, direction, { units: 'meters' }).geometry.coordinates;
    mapRef.current?.flyTo({ center: [longitude, latitude], duration: 2000, zoom: 16 });
    setSheetSnap('peek');
  }

  const summary = counterHuntSummary(state, linked, now);

  return (
    <SidebarSection
      id="counterHunt"
      title="Tegenhunt"
      summary={summary && <span className={summary.tone && SUMMARY_TONE[summary.tone]}>{summary.text}</span>}
      open={forcedOpen ?? storedOpen}
      onOpenChange={handleOpenChange}
      className={cn(active && 'bg-linear-160 from-red-500/18 to-red-500/4 outline outline-red-500/30')}
    >
      <CounterHuntCard state={state} linked={linked} now={now} onShowOnMap={homeTeam && direction !== null ? showOnMap : undefined} />
    </SidebarSection>
  );
}
