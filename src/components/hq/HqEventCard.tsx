import { useState } from 'react';
import StepDots from '@/components/tour/StepDots';
import TimerRing from '@/components/tour/TimerRing';
import CookieBadge from '@/components/tracker/CookieBadge';
import { EVENT_HOLD_MS, FLY_MS, type HqEvent, type HqTone } from '@/lib/hq-director';
import { cn } from '@/lib/utils';

const RING_CLASS: Record<HqTone, string> = { ok: 'stroke-green-500', warn: 'stroke-amber-500', danger: 'stroke-red-600', neutral: 'stroke-primary' };

/** Bottom of the map: the current event, its hold time (tour ring in the event colour) and how many are queued (tour dots). */
export default function HqEventCard({ event, queued, step }: { event: HqEvent | null; queued: number; step: number }) {
  // Keep the last event while the card slides out
  const [shown, setShown] = useState(event);
  if (event && event !== shown) setShown(event);

  return (
    <div
      aria-live="polite"
      className={cn(
        'card absolute inset-x-4 bottom-4 z-10 flex items-center gap-4 rounded-2xl bg-card px-5 py-4 text-card-foreground shadow-2xl transition-[translate,opacity] duration-900 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
        event ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[130%] opacity-0',
      )}
    >
      {shown && (
        <>
          <TimerRing className="size-16 shrink-0" durationMs={FLY_MS + EVENT_HOLD_MS} runKey={step} progressClassName={RING_CLASS[shown.tone]}>
            <CookieBadge tone={shown.tone} size={44} glyph={shown.tone === 'neutral' ? 'i' : undefined} className="size-11" />
          </TimerRing>
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-bold leading-tight">{shown.title}</p>
            <p className="truncate text-muted-foreground">{shown.detail}</p>
          </div>
          <StepDots count={queued + 1} index={0} />
        </>
      )}
    </div>
  );
}
