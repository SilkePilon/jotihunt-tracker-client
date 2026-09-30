import { RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MapRef } from '@/components/Map';
import { useIsMobile } from '@/hooks/media.hook';
import useSidebarStore from '@/stores/sidebar.store';
import { stepDuration } from './duration';
import { placeCard, type Size } from './placement';
import { stepsForPlatform, targetFor } from './resolve';
import { runActions, runUndos } from './runner';
import { TOUR_STEPS } from './steps';
import TourCard from './TourCard';
import useTourStore from './tour.store';
import type { Undo } from './types';
import { useTargetRect } from './useTargetRect';

const SPOTLIGHT_PADDING = 8;

/**
 * Runs the onboarding tour: performs each step's actions, finds its target, dims everything except the target,
 * and floats the card next to it. Mounted once in Layout; renders nothing while the tour is inactive.
 */
export default function TourOverlay({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { active, stepIndex, stepCount, direction, paused, next, prev, togglePause, skip, stop } = useTourStore();
  const isMobile = useIsMobile();
  const platform = isMobile ? 'mobile' : 'desktop';
  const steps = stepsForPlatform(TOUR_STEPS, platform);
  const step = active ? steps[stepIndex] : undefined;
  const targetId = step ? targetFor(step, platform) : null;

  // Index of the step whose actions have finished; compared per step so a stale "done" never leaks into the next one
  const [actionsDoneFor, setActionsDoneFor] = useState<number | null>(null);
  const actionsDone = active && actionsDoneFor === stepIndex;
  const target = useTargetRect(targetId, actionsDone, stepIndex);
  // The hook's state lags one render behind a step change; treat a status from another step as still pending
  const targetStatus = target.key === stepIndex ? target.status : 'pending';

  // Run the step's actions; undo them when leaving the step (next, prev, skip, finish, unmount)
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let undos: Undo[] = [];
    void runActions(step.actions ?? [], { mapRef, isMobile }).then((result) => {
      if (cancelled) runUndos(result);
      else {
        undos = result;
        setActionsDoneFor(stepIndex);
      }
    });
    return () => {
      cancelled = true;
      runUndos(undos);
      setActionsDoneFor(null);
    };
    // Re-run per step only; isMobile changes mid-tour are rare and handled by the next step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  // Snapshot the sidebar when the tour starts, restore it when it ends
  useEffect(() => {
    if (!active) return;
    const { openSections, sheetSnap } = useSidebarStore.getState();
    return () => {
      useSidebarStore.setState({ openSections, sheetSnap });
    };
  }, [active]);

  // Leaving the layout (logout, expired session) ends the tour without marking it as seen
  useEffect(() => () => stop(), [stop]);

  // Optional step whose feature is off: skip it in the direction the user was going
  useEffect(() => {
    if (step?.optional && targetStatus === 'missing') {
      if (direction === 1) next();
      else if (stepIndex > 0) prev();
      else next();
    }
  }, [step, targetStatus, direction, stepIndex, next, prev]);

  // Keyboard: → next, ← previous, Esc skip. Capture phase so menus and dialogs don't act on these keys.
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      const editing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (editing && event.key !== 'Escape') return;
      const action = { ArrowRight: next, ArrowLeft: prev, Escape: skip }[event.key];
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      action();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, next, prev, skip]);

  // Measure the card and viewport for placement
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<Size>({ width: 340, height: 180 });
  const [viewport, setViewport] = useState<Size>(() => ({ width: window.innerWidth, height: window.innerHeight }));
  // No deps on purpose: re-measure after every render (the card's text changes per step); the size check stops the loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el && (el.offsetWidth !== cardSize.width || el.offsetHeight !== cardSize.height)) {
      setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    }
  });
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!step) return null;

  const rect = targetStatus === 'found' ? target.rect : null;
  const ready = actionsDone && targetStatus !== 'pending';
  const isLast = stepIndex === stepCount - 1;
  const position = placeCard({ target: rect, card: cardSize, viewport, placement: step.placement, isMobile });

  // No target: a zero-size hole in the middle, so the whole screen is dimmed
  const hole = rect
    ? {
        top: rect.y - SPOTLIGHT_PADDING,
        left: rect.x - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : { top: viewport.height / 2, left: viewport.width / 2, width: 0, height: 0 };

  return createPortal(
    // pointer-events-auto: Radix modals set pointer-events:none on <body> while open
    <div className="pointer-events-auto fixed inset-0 z-[60]">
      {/* Click shield: the tour drives the UI, the user only uses the card */}
      <div className="absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-xl shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] transition-all duration-[350ms] ease-out motion-reduce:transition-none"
        style={hole}
      />
      <TourCard
        ref={cardRef}
        title={step.title}
        body={step.body}
        stepIndex={stepIndex}
        stepCount={stepCount}
        durationMs={ready && !isLast ? stepDuration(step) : undefined}
        paused={paused}
        position={position}
        onPrev={prev}
        onNext={next}
        onTogglePause={togglePause}
        onSkip={skip}
        onTimeUp={next}
      />
    </div>,
    document.body,
  );
}
