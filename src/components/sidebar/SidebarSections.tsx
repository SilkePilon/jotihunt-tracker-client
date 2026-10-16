import { RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MapRef } from '@/components/Map';
import HintEntryCard from '@/components/cards/hint-entry/HintEntryCard';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { usePredictions, usePredictionSetting } from '@/hooks/predictions.hook';
import { hintProgress } from '@/lib/hints';
import { REVEAL_TRANSITION } from '@/lib/motion';
import { predictionSummary } from '@/lib/prediction';
import HuntsSection from '@/components/hunts/HuntsSection';
import SidebarSection from './SidebarSection';
import FoxesCard, { FoxesSummary } from './foxes/FoxesCard';
import HintMiniGrid from './HintMiniGrid';
import PredictionList from './PredictionList';
import TrackerSection from './TrackerSection';
import CounterHuntSection from './CounterHuntSection';
import TelegramSection from './TelegramSection';
import JotiboardSection from './JotiboardSection';
import Life360Section from './Life360Section';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { SidebarSectionId } from '@/stores/sidebar.store';

/** The parent column's flex gap (gap-1.5), folded into the reveal so the sections below don't jump by a gap */
const SECTION_GAP_PX = 6;

/** All sidebar sections; `only` renders just one of them (a phone page). */
export default function SidebarSections({ mapRef, only }: { mapRef: RefObject<MapRef | null>; only?: SidebarSectionId }) {
  const show = (id: SidebarSectionId) => !only || only === id;
  const { homeTeamApiId } = useAppConfig();
  const { board } = useHintBoard();
  const { predictions } = usePredictions();
  const { enabled: predictionEnabled } = usePredictionSetting();
  const progress = board ? hintProgress(board) : undefined;

  return (
    <>
      {show('foxes') && (
        <SidebarSection id="foxes" title="Vossen" summary={<FoxesSummary />}>
          <FoxesCard />
        </SidebarSection>
      )}
      {show('hints') && (
        <SidebarSection id="hints" title="Hints" summary={progress ? `${progress.solved}/${progress.total} opgelost` : undefined}>
          <HintMiniGrid mapRef={mapRef} />
        </SidebarSection>
      )}
      {show('hunts') && (
        <ErrorBoundary name="Hunts">
          <HuntsSection />
        </ErrorBoundary>
      )}
      {show('predictions') && predictionEnabled !== false && (
        <SidebarSection id="predictions" title="Voorspelling" summary={predictionSummary(predictions)}>
          <PredictionList mapRef={mapRef} />
        </SidebarSection>
      )}
      {show('hintEntry') && (
        <SidebarSection id="hintEntry" title="Hint registreren">
          <HintEntryCard mapRef={mapRef} />
        </SidebarSection>
      )}
      {/* Unfolds once a home team is configured; overflow is only clipped while folding (the active outline sits outside) */}
      <AnimatePresence initial={false}>
        {show('counterHunt') && homeTeamApiId !== null && (
          <motion.div
            key="counterHunt"
            style={{ marginTop: -SECTION_GAP_PX }}
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            transition={REVEAL_TRANSITION}
          >
            <div style={{ paddingTop: SECTION_GAP_PX }}>
              <ErrorBoundary name="Tegenhunt">
                <CounterHuntSection mapRef={mapRef} />
              </ErrorBoundary>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {show('telegram') && (
        <ErrorBoundary name="Jotihunt-berichten">
          <TelegramSection />
        </ErrorBoundary>
      )}
      {show('tracking') && (
        <ErrorBoundary name="Tracker">
          <TrackerSection />
        </ErrorBoundary>
      )}
      {show('life360') && (
        <ErrorBoundary name="Life360">
          <Life360Section mapRef={mapRef} />
        </ErrorBoundary>
      )}
      {show('jotiboard') && (
        <ErrorBoundary name="Jotiboard">
          <JotiboardSection />
        </ErrorBoundary>
      )}
    </>
  );
}
