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

export interface NextHintState {
  articlesLoading: boolean;
  articlesError: boolean;
  isNewHint: boolean;
  huntOver: boolean;
  /** Whether a hunt start is configured */
  hasHuntStart: boolean;
  /** Whether /config has answered (a missing start may still be on its way) */
  configLoaded: boolean;
  /** Formatted time left until the next hint */
  countdown: string;
}

/** The "Volgende hint" label; `isCountdown` is true only when the label is the time left. */
export function nextHintLabel(state: NextHintState): { label: string; isCountdown: boolean } {
  if (state.articlesLoading) return { label: '…', isCountdown: false };
  if (state.articlesError) return { label: 'Fout', isCountdown: false };
  if (state.isNewHint) return { label: 'Nieuwe hint!', isCountdown: false };
  if (!state.hasHuntStart) return { label: state.configLoaded ? 'Geen hunttijd' : '…', isCountdown: false };
  if (state.huntOver) return { label: 'Geen hints meer', isCountdown: false };
  return { label: state.countdown, isCountdown: true };
}

/**
 * The next-hint part of the collapsed Hints summary ("hint over 12:34", or "nieuwe hint!" while a new one is highlighted);
 * undefined in the other states (loading, error, no hunt time, no hints left), where the summary stays the solved count.
 */
export function hintSummaryCountdown(next: { label: string; isCountdown: boolean; isNewHint: boolean }): string | undefined {
  if (next.isNewHint) return 'nieuwe hint!';
  return next.isCountdown ? `hint over ${next.label}` : undefined;
}
