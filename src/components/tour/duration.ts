import type { TourStep } from './types';

const MIN_MS = 4000;
const MAX_MS = 10000;
const MS_PER_CHAR = 40;

/** How long a step stays before auto-advancing: longer text gets more time. */
export function stepDuration(step: Pick<TourStep, 'title' | 'body' | 'durationMs'>): number {
  if (step.durationMs != null) return step.durationMs;
  const ms = MIN_MS + MS_PER_CHAR * (step.title.length + step.body.length);
  return Math.min(MAX_MS, Math.max(MIN_MS, ms));
}
