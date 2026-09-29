import { RefObject } from 'react';
import { MapRef } from '@/components/Map';
import HintEntryCard from '@/components/cards/hint-entry/HintEntryCard';
import CounterHuntCard from '@/components/cards/counter-hunt/CounterHuntCard';
import ActiveDevices from '@/components/map/ActiveDevices';
import { useAreas } from '@/hooks/areas.hook';
import { useDevices } from '@/hooks/devices.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { usePredictions, usePredictionSetting } from '@/hooks/predictions.hook';
import { statusSummary } from '@/lib/fox-status';
import { hintProgress } from '@/lib/hints';
import { predictionSummary } from '@/lib/prediction';
import { filterActiveDevices } from '@/lib/utils';
import HuntsSection from '@/components/hunts/HuntsSection';
import SidebarSection from './SidebarSection';
import FoxPills from './FoxPills';
import HintMiniGrid from './HintMiniGrid';
import PredictionList from './PredictionList';
import TrackerSection from './TrackerSection';

export default function SidebarSections({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { areas } = useAreas();
  const { board } = useHintBoard();
  const { devices } = useDevices();
  const { predictions } = usePredictions();
  const { enabled: predictionEnabled } = usePredictionSetting();
  const activeCount = filterActiveDevices(devices).length;
  const progress = board ? hintProgress(board) : undefined;

  return (
    <>
      <SidebarSection id="foxes" title="Vossen" summary={areas ? statusSummary(areas) : undefined}>
        <FoxPills />
      </SidebarSection>
      <SidebarSection id="hints" title="Hints" summary={progress ? `${progress.solved}/${progress.total} opgelost` : undefined}>
        <HintMiniGrid />
      </SidebarSection>
      <HuntsSection />
      {predictionEnabled !== false && (
        <SidebarSection id="predictions" title="Voorspelling" summary={predictionSummary(predictions)}>
          <PredictionList mapRef={mapRef} />
        </SidebarSection>
      )}
      <SidebarSection id="hintEntry" title="Hint registreren">
        <HintEntryCard mapRef={mapRef} />
      </SidebarSection>
      {import.meta.env.HOME_TEAM_API_ID && (
        <SidebarSection id="counterHunt" title="Tegenhunt">
          <CounterHuntCard mapRef={mapRef} />
        </SidebarSection>
      )}
      <TrackerSection />
      <SidebarSection id="hunters" title="Actieve hunters" summary={activeCount ? String(activeCount) : 'Niemand'}>
        <ActiveDevices mapRef={mapRef} showLabel={false} />
      </SidebarSection>
    </>
  );
}
