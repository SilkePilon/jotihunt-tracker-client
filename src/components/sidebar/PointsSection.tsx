import { AnimatePresence, motion } from 'motion/react';
import CountUp from '@/components/motion/CountUp';
import Reveal from '@/components/motion/Reveal';
import { AGE_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import { LAYOUT_SPRING, POP } from '@/lib/motion';
import { formatDelta, formatPenalty, SCORE_CATEGORIES, scoreBarSegments, scoreDelta, scoreFailing, scoreFailingLine, scoreLegend, scoreLine, scoreSummary } from '@/lib/score';
import { cn } from '@/lib/utils';
import type { ScoreParts, ScoreStatus } from '@/types/Score';
import SidebarSection from './SidebarSection';

const BAR_WIDTH = 200;
const GAP = 3;

/** 200 × 10 px bar split by hunts / tegenhunts / opdrachten / foto (hints when known); segments grow from 0 and to new widths */
function ScoreBar({ parts }: { parts: ScoreParts }) {
  const segments = scoreBarSegments(parts);
  const visible = segments.filter((segment) => segment.share > 0).length;
  const room = BAR_WIDTH - GAP * Math.max(0, visible - 1);

  return (
    <div className={cn('mx-auto mt-3 flex h-2.5 rounded-[5px] transition-colors', visible === 0 && 'bg-secondary')} style={{ width: BAR_WIDTH }} aria-hidden>
      {segments.map((segment, index) => {
        const gapBefore = segment.share > 0 && segments.slice(0, index).some((previous) => previous.share > 0) ? GAP : 0;
        return (
          <motion.i
            key={segment.key}
            className={cn('block h-full shrink-0 rounded-[5px]', SCORE_CATEGORIES[segment.key].fill)}
            initial={{ width: 0, marginLeft: 0 }}
            animate={{ width: segment.share * room, marginLeft: gapBefore }}
            transition={LAYOUT_SPRING}
          />
        );
      })}
    </div>
  );
}

function ScoreLegend({ parts }: { parts: ScoreParts }) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-x-3.5 gap-y-1 tabular-nums">
      {scoreLegend(parts).map((entry) => (
        <div key={entry.key} className="flex items-center gap-1.5 px-1 py-0.5 text-[12.5px]">
          <span className={cn('size-2 shrink-0 rounded-[2px]', entry.fill)} />
          <span className="flex-1 text-muted-foreground">{entry.label}</span>
          {/* "?" ↔ a number cross-fades when the site judges the hints */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={entry.value === null ? 'unknown' : 'known'}
              className={cn('font-semibold', entry.tone === 'muted' && 'font-normal text-muted-foreground', entry.tone === 'penalty' && 'text-red-700 dark:text-red-300')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {entry.value === null ? '?' : entry.key === 'penalty' ? formatPenalty(entry.value) : <CountUp value={entry.value} from={0} />}
            </motion.span>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/** The card's content (mockup B): big total, "voorlopig · 1 min geleden" + green "+10", the split bar and the legend. */
export function PointsView({ score }: { score: ScoreStatus }) {
  const now = useNow(true, AGE_CLOCK_TICK_MS);
  const delta = scoreDelta(score, now);
  const failing = scoreFailing(score);

  return (
    <div>
      <div className="flex flex-col items-center gap-0.5 pt-0.5 text-center">
        <div className="text-[40px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
          {score.total === null ? '–' : <CountUp value={score.total} from={0} />}
          <small className="ml-[3px] text-sm font-semibold tracking-normal text-muted-foreground">pnt</small>
        </div>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {scoreLine(score, now)}
          <AnimatePresence mode="wait" initial={false}>
            {delta !== null && (
              <motion.span key={delta} className="ml-1 inline-block font-semibold text-green-700 dark:text-green-400" {...POP}>
                {formatDelta(delta)}
              </motion.span>
            )}
          </AnimatePresence>
        </p>
        <Reveal gap={2}>{failing && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{scoreFailingLine(score, now)}</p>}</Reveal>
      </div>
      <ScoreBar parts={score.parts} />
      <ScoreLegend parts={score.parts} />
    </div>
  );
}

/** Sidebar "Punten": our provisional score from the jotihunt.nl dashboard. Only rendered while it is configured. */
export default function PointsSection({ score }: { score: ScoreStatus }) {
  return (
    <SidebarSection id="points" title="Punten" summary={scoreSummary(score)}>
      <PointsView score={score} />
    </SidebarSection>
  );
}
