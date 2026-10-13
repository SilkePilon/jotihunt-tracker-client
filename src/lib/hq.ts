import type { Article } from '@/types/Article';

/** The newest assignment whose deadline hasn't passed (news can have an endTime too, but isn't an assignment). */
export function openAssignment(articles: Article[] | undefined, now: number): Article | undefined {
  return (articles ?? [])
    .filter((article) => article.type === 'assignment' && !!article.endTime && new Date(article.endTime).getTime() > now)
    .reduce<Article | undefined>((latest, article) => (!latest || new Date(article.publishAt) > new Date(latest.publishAt) ? article : latest), undefined);
}
