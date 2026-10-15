import { type RefObject, useState } from 'react';
import { motion } from 'motion/react';
import { Tag } from '@/components/beheer/controls/Pill';
import type { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import { OV_KIND_LABEL, areaLabel, ovClock } from '@/lib/intel-chat';
import { EASE_OUT } from '@/lib/motion';
import type { OvCandidate, OvPredictionResult } from '@/types/IntelChat';
import { MoreToggle } from './OvShared';
import { ShowOnMapPill } from './PointCard';

/** predictOvMovement card: ranked candidates (route, kind, time, score bar, area, "Toon op kaart") and the assumptions behind them */
export default function OvPredictionCard({ prediction, mapRef }: { prediction: OvPredictionResult; mapRef: RefObject<MapRef | null> }) {
  const [open, setOpen] = useState(false);
  const { candidates, assumptions } = prediction;
  return (
    <div className="overflow-hidden rounded-[18px] bg-beheer-row">
      <div className="grid gap-2 px-3 py-2.5 text-[12.5px]">
        {prediction.note && <p className="text-[12px] text-muted-foreground">{prediction.note}</p>}
        {candidates.length === 0 ? (
          <p className="text-muted-foreground">Geen kandidaten</p>
        ) : (
          <ol className="grid gap-1.5">
            {candidates.map((candidate, index) => (
              <CandidateRow key={index} rank={index + 1} candidate={candidate} mapRef={mapRef} />
            ))}
          </ol>
        )}
        {assumptions.length > 0 && (
          <div className="flex flex-col">
            <MoreToggle open={open} onToggle={() => setOpen(!open)} more="Aannames" less="Aannames verbergen" />
            <Reveal>
              {open && (
                <ul className="list-disc space-y-0.5 pt-1 pl-4 text-[11.5px] text-muted-foreground">
                  {assumptions.map((assumption, index) => (
                    <li key={index}>{assumption}</li>
                  ))}
                </ul>
              )}
            </Reveal>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateRow({ rank, candidate, mapRef }: { rank: number; candidate: OvCandidate; mapRef: RefObject<MapRef | null> }) {
  const { area } = candidate.point;
  const score = Math.min(1, Math.max(0, candidate.score));
  return (
    <li className="grid gap-1.5 rounded-xl bg-beheer-row-high/60 p-2">
      <div className="flex min-w-0 items-start gap-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ai-think-container text-[11px] font-extrabold text-ai-on-think tabular-nums">{rank}</span>
        <span className="min-w-0 flex-1 font-semibold break-words">{candidate.via}</span>
        <span className="shrink-0 font-semibold tabular-nums">{ovClock(candidate.atTime)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-7">
        <Tag tone="info">{OV_KIND_LABEL[candidate.kind] ?? candidate.kind}</Tag>
        <Tag tone="neutral">{area.area ? areaLabel(area.area) : 'onbekend gebied'}</Tag>
        {area.area && area.method !== 'hull' && <Tag tone="warn">schatting</Tag>}
      </div>
      {candidate.why && <p className="pl-7 text-[11.5px] text-muted-foreground line-clamp-2">{candidate.why}</p>}
      <div className="flex items-center gap-2 pl-7">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-beheer-row" role="meter" aria-label="Score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(score * 100)}>
          <motion.div className="h-full origin-left rounded-full bg-ai-on-think/70" initial={{ scaleX: 0 }} animate={{ scaleX: score }} transition={{ duration: 0.5, ease: EASE_OUT }} />
        </div>
        <span className="w-8 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">{Math.round(score * 100)}%</span>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-7">
        <ShowOnMapPill point={candidate.point} mapRef={mapRef} />
      </div>
    </li>
  );
}
