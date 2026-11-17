import { RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MapRef } from '@/components/Map';
import { useIsMobile } from '@/hooks/media.hook';
import { ownsKey, trapTabIndex } from '@/lib/focus';
import { cn } from '@/lib/utils';
import type { MobilePage } from '@/lib/mobile-nav';
import useMobileNavStore from '@/stores/mobile-nav.store';
import useSidebarStore from '@/stores/sidebar.store';
import useViewportStore from '@/stores/viewport.store';
import { useShallow } from 'zustand/react/shallow';
import { autoAdvances, stepDuration } from './duration';
import { phonePanelMaxHeight, placeCard, type Size } from './placement';
import { stepsForPlatform, targetFor } from './resolve';
import { tourTarget } from './targets';
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
 * Not a takeover: the card's pause/play control (it pauses, or turns auto-advance back on) and the spotlight (a tap
 * there is the same as Volgende, and the tour keeps running by itself afterwards)
 */
const NOT_TAKEOVER = '[data-tour-timer], [data-tour-spotlight]';
const onTimerControl = (target: EventTarget | null) => target instanceof Element && !!target.closest(NOT_TAKEOVER);
/** What Tab can land on in the card and the panel */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Runs the onboarding tour: performs each step's actions, finds its target, dims everything except the target,
 * and floats the card next to it. Mounted once in Layout; renders nothing while the tour is inactive.
 */
export default function TourOverlay({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { active, stepIndex, direction, paused, manual, next, prev, togglePause, takeOver, resumeAuto, skip, stop } = useTourStore();
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
  const navSnapshot = useRef<MobilePage[] | null>(null);
  const startPlatform = useRef(platform);
  useLayoutEffect(() => {
    if (!active) return;
    const { openSections, sheetSnap } = useSidebarStore.getState();
    snapshot.current = { openSections, sheetSnap };
    navSnapshot.current = useMobileNavStore.getState().stack;
    startPlatform.current = platform;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The step list depends on the platform, so crossing the breakpoint mid-tour (rotating a tablet, resizing the window)
  // invalidates stepCount and stepIndex: end it as skipped (marked seen), so it doesn't start over on every load
  useEffect(() => {
    if (!active) return;
    if (startPlatform.current !== platform) skip();
    else if (!step) stop();
  }, [active, step, platform, skip, stop]);

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
      if (navSnapshot.current) useMobileNavStore.setState({ stack: navSnapshot.current, direction: -1 });
      navSnapshot.current = null;
    };
  }, [active]);

  // Leaving the layout (logout, expired session) ends the tour without marking it as seen
  useEffect(() => () => stop(), [stop]);

  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  // Focus the card at the start and on every step, so screen readers read it and the arrow keys work. Not when focus is
  // already in it (a keyboard user on "Volgende" stays there).
  useEffect(() => {
    const card = cardRef.current;
    if (!active || !card || card.contains(document.activeElement)) return;
    card.focus({ preventScroll: true });
  }, [active, stepIndex]);

  // Optional step whose feature is off: skip it in the direction the user was going
  useEffect(() => {
    if (step?.optional && targetStatus === 'missing') {
      if (direction === 1) next();
      else if (stepIndex > 0) prev();
      else next();
    }
  }, [step, targetStatus, direction, stepIndex, next, prev]);

  // Keyboard: → next, ← previous, Esc skip; only while focus is on the card or nowhere (<body>). Elsewhere these keys
  // belong to what has focus: a menu, a toggle group, the map, a tour panel.
  // Tab stays inside the card and the step's panel (the overlay is a modal dialog), while focus is in them or nowhere.
  const panelRef = useRef<HTMLDivElement>(null);
  // The welcome waits for Volgende: using the card there starts the tour rather than taking it over
  const waitsForUser = !!step?.waitsForUser;
  const waitsForUserRef = useRef(waitsForUser);
  useLayoutEffect(() => {
    waitsForUserRef.current = waitsForUser;
  }, [waitsForUser]);
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      // A key on the tour (card, panel, or with focus nowhere) is the user taking over: auto-advance stops
      if (ownsKey(event, document.body, [panelRef.current, cardRef.current]) && !onTimerControl(event.target) && !waitsForUserRef.current) takeOver();
      if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const surfaces = [panelRef.current, cardRef.current];
        if (!ownsKey(event, document.body, surfaces)) return;
        const focusables = surfaces.flatMap((surface) => (surface ? [...surface.querySelectorAll<HTMLElement>(FOCUSABLE)] : [])).filter((el) => el.getClientRects().length > 0);
        const index = trapTabIndex(focusables.length, focusables.indexOf(document.activeElement as HTMLElement), event.shiftKey);
        if (index === null) return;
        event.preventDefault();
        focusables[index].focus();
        return;
      }
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!ownsKey(event, document.body, [cardRef.current])) return;
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
  }, [active, next, prev, skip, takeOver]);

  const [cardSize, setCardSize] = useState<Size>({ width: 340, height: 180 });
  const [windowSize, setWindowSize] = useState<Size>(() => ({ width: window.innerWidth, height: window.innerHeight }));
  // Phones: the visual viewport (without browser toolbars or an open keyboard) and the safe areas, measured by the
  // mobile shell, so the docked card never hides under the notch or the home indicator
  const phone = useViewportStore(useShallow((s) => ({ visibleH: s.visibleH, safeTop: s.safeTop, safeBottom: s.safeBottom })));
  const viewport: Size = isMobile ? { width: windowSize.width, height: phone.visibleH } : windowSize;
  const safe = isMobile ? { top: phone.safeTop, bottom: phone.safeBottom } : undefined;
  // Measure the card and viewport for placement. No deps on purpose: re-measure after every render (the card's text changes per step); the size check stops the loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el && (el.offsetWidth !== cardSize.width || el.offsetHeight !== cardSize.height)) {
      setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    }
  });
  useEffect(() => {
    const onResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
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
  const position = placeCard({ target: rect, card: cardSize, viewport, placement: step?.placement, isMobile, safe });
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

  const Panel = step.panel;
  const shownStep = (shownIndex !== null && steps[shownIndex]) || step;
  // A step that auto-advances (when not manual): not the welcome, not a panel the user works in, and on screen. The
  // last one finishes the tour when its time is up
  const timed = ready && autoAdvances(step) && shownIndex === stepIndex;
  // A tap on the spotlighted target counts as Volgende (not on a panel step: the gap around the panel is too easy to hit)
  const holeClickable = ready && targetStatus === 'found' && !step.panel;

  return createPortal(
    // pointer-events-auto: Radix modals set pointer-events:none on <body> while open. A modal dialog (card + panel)
    // named by the card's title and body; Tab stays inside it (onKey above)
    // Any pointer on the tour (card, panel, the dimmed screen) is the user taking over: auto-advance stops for the rest
    // (except the pause/play control, which toggles pause or resumes auto-advance, and the spotlight, which is Volgende)
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="pointer-events-auto fixed inset-0 z-[60]"
      onPointerDownCapture={(event) => {
        if (!onTimerControl(event.target) && !step.waitsForUser) takeOver();
      }}
    >
      {/* Click shield: the tour drives the UI, the user only uses the card */}
      <div className="absolute inset-0" />
      {/* The spotlight. Only its box takes pointers (the dimming shadow doesn't): a tap on the highlighted target goes
          to the next step, like Volgende (the card's button stays the keyboard way). Not a takeover: auto-advance
          carries on */}
      <div
        aria-hidden
        data-tour-spotlight
        ref={holeRef}
        onClick={holeClickable ? next : undefined}
        className={cn(
          'fixed left-0 top-0 rounded-xl shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] will-change-[transform,width,height]',
          holeClickable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none',
        )}
      />
      {Panel && (
        // Above the dim layer and the click shield, so the user can use it. Phones: at the top, the card docks below.
        // Desktop: shifted left by half a card (340px + gap), so the card fits beside it. Phones: it stops above the
        // docked card (measured), so nothing in the panel hides under it
        <div
          key={step.id}
          ref={panelRef}
          {...tourTarget('tour.panel')}
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] w-[min(400px,calc(100vw-24px))] -translate-x-1/2 overflow-y-auto rounded-xl border bg-background shadow-2xl animate-in fade-in duration-300 max-h-[calc(100dvh-24px-env(safe-area-inset-top))] md:left-[calc(50%-376px)] md:top-1/2 md:-translate-y-1/2 md:translate-x-0 motion-reduce:animate-none"
          style={isMobile ? { maxHeight: `calc(${phonePanelMaxHeight(viewport.height, cardSize.height, SPOTLIGHT_PADDING, phone.safeBottom)}px - env(safe-area-inset-top))` } : undefined}
        >
          <Panel />
        </div>
      )}
      <TourCard
        ref={cardRef}
        title={shownStep.title}
        titleId={titleId}
        bodyId={bodyId}
        body={shownStep.body}
        contentVisible={shownIndex === stepIndex}
        stepIndex={stepIndex}
        stepCount={steps.length}
        durationMs={!manual && timed ? stepDuration(step) : undefined}
        timed={timed}
        manual={manual}
        paused={paused}
        hidden={hideCard}
        onPrev={prev}
        onNext={next}
        onTogglePause={togglePause}
        onResumeAuto={resumeAuto}
        onSkip={skip}
        onTimeUp={next}
      />
    </div>,
    document.body,
  );
}
