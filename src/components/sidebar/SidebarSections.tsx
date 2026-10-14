import { RefObject } from 'react';
import { MapRef } from '@/components/Map';
import HintEntryCard from '@/components/cards/hint-entry/HintEntryCard';
import { useHintBoard } from '@/hooks/hints.hook';
import { usePredictions, usePredictionSetting } from '@/hooks/predictions.hook';
import { hintProgress } from '@/lib/hints';
import { predictionSummary } from '@/lib/prediction';
import HuntsSection from '@/components/hunts/HuntsSection';
import SidebarSection from './SidebarSection';
import { FoxesSummary } from './foxes/FoxesCard';
import FoxPills from './FoxPills';
import HintMiniGrid from './HintMiniGrid';
import PredictionList from './PredictionList';
import TrackerSection from './TrackerSection';
import CounterHuntSection from './CounterHuntSection';
import TelegramSection from './TelegramSection';
import Life360Section from './Life360Section';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function SidebarSections({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { board } = useHintBoard();
  const { predictions } = usePredictions();
  const { enabled: predictionEnabled } = usePredictionSetting();
  const progress = board ? hintProgress(board) : undefined;

  return (
    <>
      <SidebarSection id="foxes" title="Vossen" summary={<FoxesSummary />}>
        <FoxPills />
      </SidebarSection>
      <SidebarSection id="hints" title="Hints" summary={progress ? `${progress.solved}/${progress.total} opgelost` : undefined}>
        <HintMiniGrid mapRef={mapRef} />
      </SidebarSection>
      <ErrorBoundary name="Hunts">
        <HuntsSection />
      </ErrorBoundary>
      {predictionEnabled !== false && (
        <SidebarSection id="predictions" title="Voorspelling" summary={predictionSummary(predictions)}>
          <PredictionList mapRef={mapRef} />
        </SidebarSection>
      )}
      <SidebarSection id="hintEntry" title="Hint registreren">
        <HintEntryCard mapRef={mapRef} />
      </SidebarSection>
      {import.meta.env.HOME_TEAM_API_ID && (
        <ErrorBoundary name="Tegenhunt">
          <CounterHuntSection mapRef={mapRef} />
        </ErrorBoundary>
      )}
      <ErrorBoundary name="Jotihunt-berichten">
        <TelegramSection />
      </ErrorBoundary>
      <ErrorBoundary name="Tracker">
        <TrackerSection />
      </ErrorBoundary>
      <ErrorBoundary name="Life360">
        <Life360Section mapRef={mapRef} />
      </ErrorBoundary>
    </>
  );
}
