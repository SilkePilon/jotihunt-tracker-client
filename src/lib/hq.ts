import type { Article } from '@/types/Article';

export function latestNonHintArticle(articles: Article[] | undefined): Article | undefined {
  return (articles ?? [])
    .filter((article) => article.type !== 'hint')
    .reduce<Article | undefined>((latest, article) => (!latest || new Date(article.publishAt) > new Date(latest.publishAt) ? article : latest), undefined);
}
