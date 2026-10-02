import type { AppNotification } from './notifications';
import type { Article } from '@/types/Article';

/** Full-screen banner colour on the HQ screen. */
export function bannerClass(notification: Pick<AppNotification, 'type' | 'data'>): string {
  if (notification.type === 'fox-status') {
    if (notification.data.status === 'green') return 'bg-green-600 text-white';
    if (notification.data.status === 'orange') return 'bg-orange-500 text-white';
    return 'bg-red-600 text-white';
  }
  if (notification.type === 'hunt-deadline') return 'bg-orange-500 text-white';
  if (notification.type === 'broadcast') return 'bg-purple-700 text-white';
  return 'bg-blue-600 text-white';
}

export function latestNonHintArticle(articles: Article[] | undefined): Article | undefined {
  return (articles ?? [])
    .filter((article) => article.type !== 'hint')
    .reduce<Article | undefined>((latest, article) => (!latest || new Date(article.publishAt) > new Date(latest.publishAt) ? article : latest), undefined);
}
