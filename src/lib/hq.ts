import type { Article } from '@/types/Article';

/** The newest assignment whose deadline hasn't passed (news can have an endTime too, but isn't an assignment). */
export function openAssignment(articles: Article[] | undefined, now: number): Article | undefined {
  return (articles ?? [])
    .filter((article) => article.type === 'assignment' && !!article.endTime && new Date(article.endTime).getTime() > now)
    .reduce<Article | undefined>((latest, article) => (!latest || new Date(article.publishAt) > new Date(latest.publishAt) ? article : latest), undefined);
}

/** Whether this page is the HQ wall screen (route /hq), which runs unattended on a beamer. */
export function isHqWall(pathname: string): boolean {
  return /^\/hq\/?$/.test(pathname);
}

/** The HQ hunts feed shows at least this many lines, however small the card */
export const HQ_FEED_MIN = 3;

/**
 * How many hunt lines fit the HQ hunts card: whole rows of `rowHeight` in the `available` px under its header, at least
 * {@link HQ_FEED_MIN} (the card clips what doesn't fit). Not measured yet (0 or not a number): the minimum.
 */
export function hqFeedSize(available: number, rowHeight: number): number {
  if (!(available > 0) || !(rowHeight > 0)) return HQ_FEED_MIN;
  return Math.max(HQ_FEED_MIN, Math.floor(available / rowHeight));
}
