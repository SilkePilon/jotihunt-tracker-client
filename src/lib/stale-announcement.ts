import type { ConnectionProblem } from '@/lib/connection';

/**
 * What the stale badge's live region says for a problem: like the badge, but without the age, so it only changes (and
 * is only read out again) when the problem itself or the list of feeds changes, not every minute. '' = nothing wrong.
 */
export function problemAnnouncement(problem: ConnectionProblem | null): string {
  if (!problem) return '';
  const { ageMs, feeds } = problem;
  if (feeds.length === 0) return ageMs === null ? 'Geen verbinding' : 'Geen verbinding, gegevens niet bijgewerkt';
  const names = feeds.length === 1 ? feeds[0] : `${feeds.slice(0, -1).join(', ')} en ${feeds[feeds.length - 1]}`;
  const subject = names.charAt(0).toUpperCase() + names.slice(1);
  return ageMs === null ? `${subject} niet geladen` : `${subject} niet bijgewerkt`;
}
