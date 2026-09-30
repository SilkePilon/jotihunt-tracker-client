import { forwardRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TourCardProps {
  title: string;
  body: string;
  stepIndex: number;
  stepCount: number;
  /** Auto-advance time; undefined = no progress bar (last step, or still loading) */
  durationMs?: number;
  paused: boolean;
  /** Keep the card mounted (for measuring and transitions) but invisible, e.g. for an optional step about to be skipped */
  hidden?: boolean;
  position: { x: number; y: number };
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
  onSkip: () => void;
  /** Fired when the progress bar is full */
  onTimeUp: () => void;
}

/** The floating tour card. It glides to `position`; its progress bar is the auto-advance timer. */
const TourCard = forwardRef<HTMLDivElement, TourCardProps>(function TourCard(props, ref) {
  const { title, body, stepIndex, stepCount, durationMs, paused, hidden, position, onPrev, onNext, onTogglePause, onSkip, onTimeUp } = props;
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
      aria-live="polite"
      aria-label={title}
      className={cn(
        'pointer-events-auto fixed left-0 top-0 z-[70] w-[min(340px,calc(100vw-24px))] gap-3 overflow-hidden py-4 shadow-2xl transition-transform duration-[350ms] ease-out motion-reduce:transition-none',
        hidden && 'invisible',
      )}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
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
      <div className="absolute inset-x-0 top-0 h-1 bg-muted">
        {durationMs !== undefined && (
          <div
            // Remount per step so the animation restarts
            key={stepIndex}
            className="h-full origin-left bg-primary"
            style={{
              animation: `tour-progress ${durationMs}ms linear forwards`,
              animationPlayState: paused || hovered ? 'paused' : 'running',
            }}
            onAnimationEnd={onTimeUp}
          />
        )}
      </div>
      <div className="flex flex-col gap-1 px-4">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex items-center gap-1 px-4">
        <span className="mr-auto text-xs text-muted-foreground tabular-nums">
          {stepIndex + 1}/{stepCount}
        </span>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Overslaan
        </Button>
        <Button variant="outline" size="icon" aria-label={paused ? 'Verder' : 'Pauzeren'} onClick={onTogglePause} disabled={durationMs === undefined}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </Button>
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
