import { useState } from 'react';
import Reveal from '@/components/motion/Reveal';
import { formatClock } from '@/lib/format';
import { delayLabel } from '@/lib/intel-chat';
import type { OvDeparture, OvDeparturesResult } from '@/types/IntelChat';
import { LineChip, ModeIcon, MoreToggle } from './OvShared';

const FIRST = 8;

/** ovDepartures card: "Vertrek {halte}", the first 8 departures (the rest unfolds), each mode, line, destination, time, delay, platform */
export default function DeparturesCard({ departures: result }: { departures: OvDeparturesResult }) {
  const [open, setOpen] = useState(false);
  const { departures } = result;
  const rest = departures.slice(FIRST);
  return (
    <div className="overflow-hidden rounded-[18px] bg-beheer-row">
      <div className="grid gap-1.5 px-3 py-2.5 text-[12.5px]">
        <div className="truncate text-[13px] font-semibold">Vertrek {result.stop.name}</div>
        {result.note && <p className="text-[12px] text-muted-foreground">{result.note}</p>}
        {departures.length === 0 ? (
          <p className="text-muted-foreground">Geen vertrekken</p>
        ) : (
          <div>
            <ul className="grid gap-0.5">
              {departures.slice(0, FIRST).map((departure, index) => (
                <DepartureRow key={index} departure={departure} />
              ))}
            </ul>
            <Reveal>
              {open && rest.length > 0 && (
                <ul className="grid gap-0.5 pt-0.5">
                  {rest.map((departure, index) => (
                    <DepartureRow key={index} departure={departure} />
                  ))}
                </ul>
              )}
            </Reveal>
          </div>
        )}
        {rest.length > 0 && <MoreToggle open={open} onToggle={() => setOpen(!open)} more={`Toon alle ${departures.length}`} />}
      </div>
    </div>
  );
}

function DepartureRow({ departure }: { departure: OvDeparture }) {
  const delay = delayLabel(departure.delayMin);
  return (
    <li className="flex min-w-0 items-center gap-2 py-0.5">
      <ModeIcon mode={departure.mode} />
      <LineChip line={departure.line} />
      <span className="min-w-0 flex-1 truncate">{departure.destination}</span>
      {departure.platform && (
        <span className="shrink-0 text-[11.5px] text-muted-foreground">
          {departure.mode === 'TRAIN' ? 'spoor' : 'perron'} {departure.platform}
        </span>
      )}
      <span className="flex shrink-0 items-baseline gap-1 font-semibold tabular-nums">
        {formatClock(departure.expected)}
        {delay && <span className="text-[11.5px] font-bold text-destructive dark:text-red-300">{delay}</span>}
      </span>
    </li>
  );
}
