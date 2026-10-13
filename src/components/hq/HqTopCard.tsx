import { useArticles } from '@/hooks/articles.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useNextHint } from '@/hooks/next-hint.hook';
import { formatClock, formatCountdown } from '@/lib/format';
import { latestNonHintArticle } from '@/lib/hq';
import { huntListItems, totalPoints } from '@/lib/hunt-reports';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<string, string> = { assignment: 'Opdracht', news: 'Nieuws' };

/** Clock, next hint, hunts and points; plus the open assignment and its deadline while one runs. */
export default function HqTopCard({ now }: { now: number }) {
  const { label, isNewHint } = useNextHint();
  const { reports } = useHuntReports();
  const { hunts } = useHunts();
  const { articles } = useArticles();
  const items = huntListItems(reports, hunts);
  const article = latestNonHintArticle(articles);
  const left = article?.endTime ? new Date(article.endTime).getTime() - now : 0;

  return (
    <section className="card flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 text-card-foreground">
      <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-5">
        <div className="text-[2.9rem] font-bold leading-[0.9] tracking-tight tabular-nums">{formatClock(now)}</div>
        <div>
          <div className="text-sm text-muted-foreground">Volgende hint</div>
          <div className={cn('text-[1.6rem] font-bold leading-tight tabular-nums text-primary', isNewHint && 'text-green-700 dark:text-green-400')}>{label}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground tabular-nums">{items.length} hunts</div>
          <div className="text-[1.6rem] font-bold leading-tight tabular-nums">{totalPoints(items)} pt</div>
        </div>
      </div>
      {article && left > 0 && (
        <div className="flex items-baseline gap-2 border-t pt-2">
          <span className="font-semibold text-primary">{TYPE_LABEL[article.type] ?? 'Opdracht'}</span>
          <span className="min-w-0 flex-1 truncate">{article.title}</span>
          <span className="font-semibold tabular-nums text-primary">{formatCountdown(left)}</span>
        </div>
      )}
    </section>
  );
}
