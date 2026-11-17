import { AnimatePresence, motion } from 'motion/react';
import LoadError from '@/components/LoadError';
import { Skeleton } from '@/components/ui/skeleton';
import { useArticles } from '@/hooks/articles.hook';
import { useHuntSync } from '@/hooks/hunt-sync.hook';
import { useNextHint } from '@/hooks/next-hint.hook';
import { formatClock, formatCountdown } from '@/lib/format';
import { openAssignment } from '@/lib/hq';
import { loadState } from '@/lib/load-state';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Clock, next hint, hunts and points; plus the open assignment and its deadline while one runs. */
export default function HqTopCard({ now }: { now: number }) {
  const { label, isNewHint } = useNextHint();
  const { status, isError, retry } = useHuntSync();
  // Unknown is not "0 hunts / 0 pt": a skeleton while it loads, a retry when the first load failed
  const view = loadState(status, isError);
  const { articles } = useArticles();
  const assignment = openAssignment(articles, now);
  const left = assignment ? new Date(assignment.endTime).getTime() - now : 0;

  return (
    <section className="card flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 text-card-foreground">
      <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-5">
        <div className="text-[2.9rem] font-bold leading-[0.9] tracking-tight tabular-nums">{formatClock(now)}</div>
        <div>
          <div className="text-sm text-muted-foreground">Volgende hint</div>
          <div className={cn('text-[1.6rem] font-bold leading-tight tabular-nums text-primary-text', isNewHint && 'text-fox-ok')}>{label}</div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {view === 'ready' && status ? (
            <motion.div key="ready" {...SWAP} className="text-right">
              <div className="text-sm text-muted-foreground tabular-nums">{status.counts.total} hunts</div>
              <div className="text-[1.6rem] font-bold leading-tight tabular-nums">{status.points} pt</div>
            </motion.div>
          ) : view === 'error' ? (
            <motion.div key="error" {...SWAP}>
              <LoadError message="Hunts en punten niet geladen." onRetry={retry} scale className="justify-end text-sm" />
            </motion.div>
          ) : (
            <motion.div key="loading" {...SWAP} className="flex flex-col items-end gap-1.5" role="status" aria-label="Punten laden">
              <Skeleton className="h-[1.1rem] w-16" />
              <Skeleton className="h-[1.6rem] w-24" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {assignment && (
        <div className="flex items-baseline gap-2 border-t pt-2">
          <span className="font-semibold text-primary-text">Opdracht</span>
          <span className="min-w-0 flex-1 truncate">{assignment.title}</span>
          <span className="font-semibold tabular-nums text-primary-text">{formatCountdown(left)}</span>
        </div>
      )}
    </section>
  );
}
