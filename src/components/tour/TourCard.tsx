import { forwardRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import StepDots from './StepDots';
import TimerRing from './TimerRing';

interface TourCardProps {
  title: string;
  /** Ids for the overlay's dialog (aria-labelledby / aria-describedby) */
  titleId: string;
  bodyId: string;
  body: string;
  /** False while the next step loads: the text fades out and fades back in with the new step's text */
  contentVisible: boolean;
  stepIndex: number;
  stepCount: number;
  /** Auto-advance time; undefined = no timer ring progress (last step, or still loading) */
  durationMs?: number;
  paused: boolean;
  /** Keep the card mounted (for measuring and transitions) but invisible, e.g. for an optional step about to be skipped */
  hidden?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
  onSkip: () => void;
  /** Fired when the timer ring is full */
  onTimeUp: () => void;
}

/** The floating tour card. The overlay positions it (via the ref); the ring around the pause button is the auto-advance timer. */
const TourCard = forwardRef<HTMLDivElement, TourCardProps>(function TourCard(props, ref) {
  const { title, titleId, bodyId, body, contentVisible, stepIndex, stepCount, durationMs, paused, hidden, onPrev, onNext, onTogglePause, onSkip, onTimeUp } = props;
  const [hovered, setHovered] = useState(false);
  // Focus on one of the card's buttons (any input): the overlay then leaves focus there on a new step, so the step's
  // text is read out through the live region below. When the card itself gets focus, the dialog reads it instead.
  const [buttonFocused, setButtonFocused] = useState(false);
  const [announce, setAnnounce] = useState(false);
  // The card moves away from a still cursor without pointerleave, so reset hover when the step changes
  const [prevStepIndex, setPrevStepIndex] = useState(stepIndex);
  if (stepIndex !== prevStepIndex) {
    setPrevStepIndex(stepIndex);
    setHovered(false);
    setAnnounce(buttonFocused);
  }
  // A keyboard user on one of the card's buttons pauses auto-advance (focus on the card itself, as each step gives it, doesn't)
  const [keyboardInside, setKeyboardInside] = useState(false);
  const isLast = stepIndex === stepCount - 1;

  return (
    <Card
      ref={ref}
      // The overlay is the (modal) dialog, labelled by the title and body here. Focused per step by the overlay
      // (programmatic only, so no ring)
      tabIndex={-1}
      onFocus={(event) => {
        const onButton = event.target !== event.currentTarget;
        setKeyboardInside(onButton && event.target.matches(':focus-visible'));
        setButtonFocused(onButton);
        if (!onButton) setAnnounce(false);
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setKeyboardInside(false);
        setButtonFocused(false);
        setAnnounce(false);
      }}
      className={cn(
        'pointer-events-auto fixed left-0 top-0 z-[70] w-[min(340px,calc(100vw-24px))] gap-3 overflow-hidden py-4 shadow-2xl outline-none will-change-transform',
        hidden && 'invisible',
      )}
      // Hover counts only after real movement: a card gliding under a parked cursor fires synthetic
      // pointer events with zero movement, which would otherwise freeze the timer until the mouse moves
      onPointerMove={(event) => {
        if (event.movementX !== 0 || event.movementY !== 0) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      // Touching the card pauses auto-advance while the finger is down
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') setHovered(true);
      }}
      onPointerUp={(event) => {
        if (event.pointerType === 'touch') setHovered(false);
      }}
      onPointerCancel={(event) => {
        if (event.pointerType === 'touch') setHovered(false);
      }}
    >
      <div className="flex flex-col gap-1 px-4 transition-opacity duration-150 motion-reduce:transition-none" style={{ opacity: contentVisible ? 1 : 0 }}>
        <p id={titleId} className="text-base font-semibold">
          {title}
        </p>
        <p id={bodyId} className="text-sm text-muted-foreground">
          {body}
          <span className="sr-only">
            {' '}
            (stap {stepIndex + 1} van {stepCount})
          </span>
        </p>
      </div>
      <StepDots count={stepCount} index={stepIndex} className="px-4" />
      {/* Only for a step change while focus stays on a button ("Volgende" pressed with the keyboard) */}
      <span aria-live="polite" className="sr-only">
        {announce && contentVisible ? `${title}. ${body}` : ''}
      </span>
      <div className="flex items-center gap-1 px-4">
        <Button variant="ghost" size="sm" onClick={onSkip} className="mr-auto">
          Overslaan
        </Button>
        <TimerRing className="size-9" durationMs={durationMs} runKey={stepIndex} paused={paused || hovered || keyboardInside} onDone={onTimeUp}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label={paused ? 'Verder' : 'Pauzeren'}
            onClick={onTogglePause}
            disabled={durationMs === undefined}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </Button>
        </TimerRing>
        <Button variant="outline" size="icon" aria-label="Vorige" onClick={onPrev} disabled={stepIndex === 0}>
          <ChevronLeftIcon />
        </Button>
        <Button size="sm" onClick={onNext} className={cn(isLast && 'px-4')}>
          {isLast ? 'Klaar' : 'Volgende'}
          {!isLast && <ChevronRightIcon data-icon="inline-end" />}
        </Button>
      </div>
    </Card>
  );
});

export default TourCard;
