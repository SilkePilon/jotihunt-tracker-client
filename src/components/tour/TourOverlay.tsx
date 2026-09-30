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
import { useSpotlightMotion } from './useSpotlightMotion';
import { useTargetRect } from './useTargetRect';

const SPOTLIGHT_PADDING = 8;
/** Keep in sync with the content fade duration in TourCard */
const FADE_MS = 150;

/**
 * Runs the onboarding tour: performs each step's actions, finds its target, dims everything except the target,
 * and floats the card next to it. Mounted once in Layout; renders nothing while the tour is inactive.
 */
export default function TourOverlay({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { active, stepIndex, direction, paused, next, prev, togglePause, skip, stop } = useTourStore();
  const isMobile = useIsMobile();
  const platform = isMobile ? 'mobile' : 'desktop';
  const steps = stepsForPlatform(TOUR_STEPS, platform);
  const step = active ? steps[stepIndex] : undefined;
  const targetId = step ? targetFor(step, platform) : null;

  // Index of the step whose actions have finished; compared per step so a stale "done" never leaks into the next one
  const [actionsDoneFor, setActionsDoneFor] = useState<number | null>(null);
  const actionsDone = active && actionsDoneFor === stepIndex;
  // Optional steps are usually off for a reason; don't keep the screen dimmed for long while looking
  const target = useTargetRect(targetId, actionsDone, stepIndex, step?.optional ? 600 : undefined);
  // The hook's state lags one render behind a step change; treat a status from another step as still pending
  const targetStatus = target.key === stepIndex ? target.status : 'pending';

  // Runs before every passive effect below, so the snapshot is taken before any step action touches the sidebar
  const snapshot = useRef<Pick<ReturnType<typeof useSidebarStore.getState>, 'openSections' | 'sheetSnap'> | null>(null);
  const startPlatform = useRef(platform);
  useLayoutEffect(() => {
    if (!active) return;
    const { openSections, sheetSnap } = useSidebarStore.getState();
    snapshot.current = { openSections, sheetSnap };
    startPlatform.current = platform;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The step list depends on the platform, so crossing the breakpoint mid-tour invalidates stepCount and stepIndex
  useEffect(() => {
    if (active && (!step || startPlatform.current !== platform)) stop();
  }, [active, step, platform, stop]);

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

  // Declared after the action effect: cleanups run in declaration order, so this restore comes after the step's undos
  useEffect(() => {
    if (!active) return;
    return () => {
      if (snapshot.current) useSidebarStore.setState(snapshot.current);
      snapshot.current = null;
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

  // Last step that became ready: its text stays on the card (faded out) until the next step is ready
  const ready = actionsDone && targetStatus !== 'pending';
  // An optional step without a target is about to be skipped; don't flash its text meanwhile
  const hideCard = !!step?.optional && targetStatus !== 'found';
  const [shownIndex, setShownIndex] = useState<number | null>(null);
  if (!active && shownIndex !== null) setShownIndex(null);
  // When the step last changed: the old text needs its full fade-out before the displayed step may switch
  const changedAt = useRef(0);
  useEffect(() => {
    changedAt.current = performance.now();
  }, [stepIndex]);
  const canShow = active && ready && !hideCard;
  useEffect(() => {
    if (!canShow || shownIndex === stepIndex) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wait = reduced || shownIndex === null ? 0 : Math.max(0, FADE_MS - (performance.now() - changedAt.current));
    const timer = setTimeout(() => setShownIndex(stepIndex), wait);
    return () => clearTimeout(timer);
  }, [canShow, shownIndex, stepIndex]);

  const rect = targetStatus === 'found' ? target.rect : null;
  const position = placeCard({ target: rect, card: cardSize, viewport, placement: step?.placement, isMobile });
  // No target: the hole closes in place, so the whole screen is dimmed
  const hole = rect && {
    x: rect.x - SPOTLIGHT_PADDING,
    y: rect.y - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
  const holeRef = useRef<HTMLDivElement>(null);
  // While a target is looked up (or an optional step is being skipped) everything stays where it is
  const hold = targetStatus === 'pending' || hideCard;
  useSpotlightMotion({ active: !!step, hold, card: position, hole }, cardRef, holeRef);

  if (!step) return null;

  const isLast = stepIndex === steps.length - 1;
  const shownStep = (shownIndex !== null && steps[shownIndex]) || step;

  return createPortal(
    // pointer-events-auto: Radix modals set pointer-events:none on <body> while open
    <div className="pointer-events-auto fixed inset-0 z-[60]">
      {/* Click shield: the tour drives the UI, the user only uses the card */}
      <div className="absolute inset-0" />
      <div
        aria-hidden
        ref={holeRef}
        className="pointer-events-none fixed left-0 top-0 rounded-xl shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] will-change-[transform,width,height]"
      />
      <TourCard
        ref={cardRef}
        title={shownStep.title}
        body={shownStep.body}
        contentVisible={shownIndex === stepIndex}
        stepIndex={stepIndex}
        stepCount={steps.length}
        durationMs={ready && !isLast && shownIndex === stepIndex ? stepDuration(step) : undefined}
        paused={paused}
        hidden={hideCard}
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
