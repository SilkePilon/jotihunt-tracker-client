import { useArticles } from '@/hooks/articles.hook';
import { useHuntSync } from '@/hooks/hunt-sync.hook';
import { useNextHint } from '@/hooks/next-hint.hook';
import { formatClock, formatCountdown } from '@/lib/format';
import { openAssignment } from '@/lib/hq';
import { cn } from '@/lib/utils';

/** Clock, next hint, hunts and points; plus the open assignment and its deadline while one runs. */
export default function HqTopCard({ now }: { now: number }) {
  const { label, isNewHint } = useNextHint();
  const { status } = useHuntSync();
  const { articles } = useArticles();
  const assignment = openAssignment(articles, now);
  const left = assignment ? new Date(assignment.endTime).getTime() - now : 0;

  return (
    <section className="card flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 text-card-foreground">
      <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-5">
        <div className="text-[2.9rem] font-bold leading-[0.9] tracking-tight tabular-nums">{formatClock(now)}</div>
        <div>
          <div className="text-sm text-muted-foreground">Volgende hint</div>
          <div className={cn('text-[1.6rem] font-bold leading-tight tabular-nums text-primary', isNewHint && 'text-green-700 dark:text-green-400')}>{label}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground tabular-nums">{status?.counts.total ?? 0} hunts</div>
          <div className="text-[1.6rem] font-bold leading-tight tabular-nums">{status?.points ?? 0} pt</div>
        </div>
      </div>
      {assignment && (
        <div className="flex items-baseline gap-2 border-t pt-2">
          <span className="font-semibold text-primary">Opdracht</span>
          <span className="min-w-0 flex-1 truncate">{assignment.title}</span>
          <span className="font-semibold tabular-nums text-primary">{formatCountdown(left)}</span>
        </div>
      )}
    </section>
  );
}
