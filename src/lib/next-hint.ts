import type { Article } from '@/types/Article';

/**
 * Get the publish time of the newest hint article.
 * @param articles The articles (any order)
 * @returns The newest hint time, or undefined when there are no hints
 */
export function getLastHintTime(articles?: Article[]): Date | undefined {
  const times = (articles ?? [])
    .filter((article) => article.type === 'hint')
    .map((article) => new Date(article.publishAt).getTime());
  return times.length ? new Date(Math.max(...times)) : undefined;
}

/**
 * Hints are published every full hour after the previous one, starting at the hunt start.
 * @param lastHintTime The newest hint time
 * @param huntStart The hunt start time
 * @returns When the next hint is expected
 */
export function getNextHintTime(lastHintTime: Date | undefined, huntStart: Date): Date {
  if (!lastHintTime || lastHintTime.getTime() < huntStart.getTime()) return huntStart;
  const next = new Date(lastHintTime);
  next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
  return next;
}

/**
 * Format a countdown as m:ss, or h:mm:ss from one hour.
 */
export function formatHintCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
