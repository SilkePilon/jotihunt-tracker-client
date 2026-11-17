import { RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MapRef } from '@/components/Map';
import HintEntryCard from '@/components/cards/hint-entry/HintEntryCard';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useScore } from '@/hooks/score.hook';
import { usePredictions, usePredictionSetting } from '@/hooks/predictions.hook';
import { revealTransition } from '@/lib/motion';
import { predictionSummary } from '@/lib/prediction';
import HuntsSyncCard from '@/components/hunts/HuntsSyncCard';
import SidebarSection from './SidebarSection';
import FoxesCard, { FoxesSummary } from './foxes/FoxesCard';
import HintMiniGrid from './HintMiniGrid';
import HintsSummary from './HintsSummary';
import PredictionList from './PredictionList';
import TrackerSection from './TrackerSection';
import CounterHuntSection from './CounterHuntSection';
import TelegramSection from './TelegramSection';
import JotiboardSection from './JotiboardSection';
import Life360Section from './Life360Section';
import PointsSection from './PointsSection';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { SidebarSectionId } from '@/stores/sidebar.store';
import { SidebarSectionVariantContext } from './section-variant';

/** The parent column's flex gap (gap-1.5), folded into the reveal so the sections below don't jump by a gap */
const SECTION_GAP_PX = 6;

/** All sidebar sections; `only` renders just one of them (a phone page). */
export default function SidebarSections({ mapRef, only }: { mapRef: RefObject<MapRef | null>; only?: SidebarSectionId }) {
  const reduced = useReducedMotion() ?? false;
  const show = (id: SidebarSectionId) => !only || only === id;
  const { homeTeamApiId } = useAppConfig();
  const { predictions } = usePredictions();
  const { enabled: predictionEnabled } = usePredictionSetting();
  const { score, isError: scoreError, retry: retryScore } = useScore();

  return (
    // A phone page (`only`) renders its section as the static page card
    <SidebarSectionVariantContext value={only ? 'page' : 'card'}>
      {show('foxes') && (
        <SidebarSection id="foxes" title="Vossen" summary={<FoxesSummary />}>
          <FoxesCard mapRef={mapRef} />
        </SidebarSection>
      )}
      {show('hints') && (
        <SidebarSection id="hints" title="Hints" summary={<HintsSummary />}>
          <HintMiniGrid mapRef={mapRef} />
        </SidebarSection>
      )}
      {/* Unfolds once the jotihunt.nl score is configured (like the tegenhunt section below), or with a retry when the first load failed */}
      <AnimatePresence initial={false}>
        {show('points') && (score?.configured || (!score && scoreError)) && (
          <motion.div
            key="points"
            style={{ marginTop: -SECTION_GAP_PX }}
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden', transition: revealTransition(reduced, 'exit') }}
            transition={revealTransition(reduced, 'enter')}
          >
            <div style={{ paddingTop: SECTION_GAP_PX }}>
              <ErrorBoundary name="Punten">
                <PointsSection score={score} onRetry={retryScore} />
              </ErrorBoundary>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {show('hunts') && (
        <ErrorBoundary name="Hunts">
          <HuntsSyncCard mapRef={mapRef} />
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
            exit={{ height: 0, opacity: 0, overflow: 'hidden', transition: revealTransition(reduced, 'exit') }}
            transition={revealTransition(reduced, 'enter')}
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
    </SidebarSectionVariantContext>
  );
}
