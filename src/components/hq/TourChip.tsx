import StepDots from '@/components/tour/StepDots';
import TimerRing from '@/components/tour/TimerRing';
import { FLY_MS, GROUP_LABEL, TOUR_DWELL_MS, type TourStop } from '@/lib/hq-director';
import { cn, getColorFromArea } from '@/lib/utils';

/** Top-left on the map: which tour stop is on screen, the time until the next one (tour ring) and the stops (tour dots). */
export default function TourChip({ stop, index, count, step, hidden }: { stop: TourStop; index: number; count: number; step: number; hidden: boolean }) {
  return (
    <div
      className={cn(
        'card absolute left-4 top-4 z-10 flex items-center gap-3 rounded-2xl bg-card py-1.5 pl-1.5 pr-4 text-card-foreground shadow-lg transition-opacity duration-600 motion-reduce:transition-none',
        hidden && 'opacity-0',
      )}
    >
      <TimerRing className="size-9" durationMs={FLY_MS + TOUR_DWELL_MS} runKey={step}>
        <span className="size-3 rounded-full" style={{ backgroundColor: stop.kind === 'area' ? getColorFromArea(stop.area) : 'var(--muted-foreground)' }} />
      </TimerRing>
      <span>
        <span className="text-muted-foreground">Rondleiding</span> · <span className="font-semibold">{stop.kind === 'area' ? `${stop.name} · ${GROUP_LABEL[stop.group]}` : 'Overzicht'}</span>
      </span>
      <StepDots count={count} index={index} />
    </div>
  );
}
