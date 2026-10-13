import type { CSSProperties, Key, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// 36-unit viewBox, 2.5-unit stroke: the ring scales with the box set by className
const RING_SIZE = 36;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface TimerRingProps {
  /** Time to fill the ring; undefined = only the empty track */
  durationMs?: number;
  /** A new key restarts the fill */
  runKey: Key;
  paused?: boolean;
  /** Fired when the ring is full */
  onDone?: () => void;
  /** Stroke colour class of the progress arc */
  progressClassName?: string;
  /** Size of the box, e.g. size-9 */
  className?: string;
  children?: ReactNode;
}

/** Circular countdown, the website tour's auto-advance ring: fills once over `durationMs` around its children. */
export default function TimerRing({ durationMs, runKey, paused = false, onDone, progressClassName = 'stroke-primary', className, children }: TimerRingProps) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full -rotate-90" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" strokeWidth={RING_STROKE} className="stroke-muted" />
        {durationMs !== undefined && (
          <circle
            // Remount per run so the animation restarts
            key={runKey}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            className={progressClassName}
            style={
              {
                '--tour-ring-length': RING_LENGTH,
                animation: `tour-ring ${durationMs}ms linear forwards`,
                animationPlayState: paused ? 'paused' : 'running',
              } as CSSProperties
            }
            onAnimationEnd={onDone}
          />
        )}
      </svg>
      {children}
    </div>
  );
}
