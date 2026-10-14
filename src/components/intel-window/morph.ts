import { useReducedMotion } from 'motion/react';

/**
 * The shared `layoutId`s of an item's card frame and title (timeline card ↔ detail header). None with reduced motion:
 * motion would still paint one frame at the old place before jumping, so the views just fade instead.
 */
export function useMorphIds(id: number): { card?: string; title?: string } {
  const reduce = useReducedMotion();
  return reduce ? {} : { card: `intel-card-${id}`, title: `intel-title-${id}` };
}
