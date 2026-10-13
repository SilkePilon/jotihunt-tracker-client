import { forwardRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import StepDots from './StepDots';
import TimerRing from './TimerRing';

interface TourCardProps {
  title: string;
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
  const { title, body, contentVisible, stepIndex, stepCount, durationMs, paused, hidden, onPrev, onNext, onTogglePause, onSkip, onTimeUp } = props;
  const [hovered, setHovered] = useState(false);
  // The card moves away from a still cursor without pointerleave, so reset hover when the step changes
  const [prevStepIndex, setPrevStepIndex] = useState(stepIndex);
  if (stepIndex !== prevStepIndex) {
    setPrevStepIndex(stepIndex);
    setHovered(false);
  }
  const isLast = stepIndex === stepCount - 1;

  return (
    <Card
      ref={ref}
      role="dialog"
      aria-label={title}
      className={cn(
        'pointer-events-auto fixed left-0 top-0 z-[70] w-[min(340px,calc(100vw-24px))] gap-3 overflow-hidden py-4 shadow-2xl will-change-transform',
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
      <div aria-live="polite" className="flex flex-col gap-1 px-4 transition-opacity duration-150 motion-reduce:transition-none" style={{ opacity: contentVisible ? 1 : 0 }}>
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <StepDots count={stepCount} index={stepIndex} className="px-4" />
      <span className="sr-only">
        Stap {stepIndex + 1} van {stepCount}
      </span>
      <div className="flex items-center gap-1 px-4">
        <Button variant="ghost" size="sm" onClick={onSkip} className="mr-auto">
          Overslaan
        </Button>
        <TimerRing className="size-9" durationMs={durationMs} runKey={stepIndex} paused={paused || hovered} onDone={onTimeUp}>
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
