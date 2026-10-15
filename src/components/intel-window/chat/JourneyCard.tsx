import { type ReactNode, type RefObject, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import { formatClock } from '@/lib/format';
import { journeyAnchor, journeyWindow } from '@/lib/intel-chat';
import { cn } from '@/lib/utils';
import type { OvJourneyResult, OvJourneyStop } from '@/types/IntelChat';
import { LineChip, ModeIcon, MoreToggle } from './OvShared';
import { ShowOnMapPill } from './PointCard';

/**
 * ovJourney card: the ride's stops as a vertical timeline (passed stops muted) with the vehicle's position highlighted
 * between them ("Toon op kaart"); a long ride folds to 3 stops before and 5 after the position.
 */
export default function JourneyCard({ journey, mapRef }: { journey: OvJourneyResult; mapRef: RefObject<MapRef | null> }) {
  const [open, setOpen] = useState(false);
  const { stops, current } = journey;
  const anchor = journeyAnchor(journey);
  const { start, end } = journeyWindow(stops.length, anchor);
  const folds = start > 0 || end < stops.length;
  const row = (stop: OvJourneyStop, index: number) => (
    <StopRow key={index} stop={stop}>
      {current && anchor === index && <CurrentRow current={current} mapRef={mapRef} />}
    </StopRow>
  );
  return (
    <div className="overflow-hidden rounded-[18px] bg-beheer-row">
      <div className="grid gap-2 px-3 py-2.5 text-[12.5px]">
        <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
          <ModeIcon mode={journey.mode} />
          <LineChip line={journey.line} />
          <span className="truncate">→ {journey.destination}</span>
        </div>
        <div>
          <Reveal>{open && start > 0 && <ul>{stops.slice(0, start).map((stop, index) => row(stop, index))}</ul>}</Reveal>
          <ul>
            {current && anchor === -1 && <CurrentRow current={current} mapRef={mapRef} />}
            {stops.slice(start, end).map((stop, index) => row(stop, start + index))}
          </ul>
          <Reveal>{open && end < stops.length && <ul>{stops.slice(end).map((stop, index) => row(stop, end + index))}</ul>}</Reveal>
        </div>
        {folds && <MoreToggle open={open} onToggle={() => setOpen(!open)} more={`Toon alle ${stops.length} haltes`} />}
      </div>
    </div>
  );
}

const MUTED = new Set<OvJourneyStop['status']>(['PASSED', 'DEPARTED']);

/** One stop on the line; the current position row (when the vehicle just left it) follows it */
function StopRow({ stop, children }: { stop: OvJourneyStop; children?: ReactNode }) {
  const muted = MUTED.has(stop.status);
  const time = stop.expected ?? stop.planned;
  return (
    <>
      <li className={cn('relative flex min-w-0 items-center gap-2 py-1 pl-5', muted && 'text-muted-foreground')}>
        <span aria-hidden className="absolute inset-y-0 left-[5px] w-px bg-border" />
        <span aria-hidden className={cn('absolute left-[2px] size-[7px] rounded-full', muted ? 'bg-muted-foreground/50' : 'bg-foreground/70')} />
        <span className="min-w-0 flex-1 truncate">
          {stop.name}
          {stop.town && <span className="text-muted-foreground"> · {stop.town}</span>}
        </span>
        {time && <span className="shrink-0 tabular-nums">{formatClock(time)}</span>}
      </li>
      {children}
    </>
  );
}

function CurrentRow({ current, mapRef }: { current: NonNullable<OvJourneyResult['current']>; mapRef: RefObject<MapRef | null> }) {
  const reduce = useReducedMotion();
  const [from, to] = current.between;
  return (
    <li className="relative my-0.5 grid gap-1.5 rounded-xl bg-fox-ok-container/45 py-2 pr-2 pl-5">
      <span aria-hidden className="absolute top-[13px] left-[2px] grid size-[7px] place-items-center">
        {!reduce && (
          <motion.span
            className="absolute size-[7px] rounded-full bg-green-600 dark:bg-green-400"
            animate={{ scale: [1, 2.6], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="size-[7px] rounded-full bg-green-600 dark:bg-green-400" />
      </span>
      <span className="font-semibold">
        Nu tussen {from} en {to}
      </span>
      {current.note && <span className="text-[12px] text-muted-foreground">{current.note}</span>}
      <div className="flex flex-wrap gap-1.5">
        <ShowOnMapPill point={current} mapRef={mapRef} />
      </div>
    </li>
  );
}
