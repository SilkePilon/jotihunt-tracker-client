import { useState } from 'react';
import { useArticles } from '@/hooks/articles.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { latestNonHintArticle } from '@/lib/hq';
import { formatHintCountdown } from '@/lib/next-hint';

const TYPE_LABEL: Record<string, string> = { assignment: 'Opdracht', news: 'Nieuws' };

export default function LatestArticle() {
  const { articles } = useArticles();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  const article = latestNonHintArticle(articles);
  if (!article) return <p className="text-sm text-muted-foreground">Nog geen opdrachten of nieuws.</p>;
  const left = article.endTime ? new Date(article.endTime).getTime() - now : 0;

  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">
        {TYPE_LABEL[article.type] ?? article.type} · {new Date(article.publishAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-lg font-semibold leading-tight">{article.title}</div>
      {left > 0 && <div className="text-sm tabular-nums text-orange-500">Deadline over {formatHintCountdown(left)}</div>}
    </div>
  );
}
