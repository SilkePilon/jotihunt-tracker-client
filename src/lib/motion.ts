import type { TargetAndTransition, Transition } from 'motion/react';

/** Shared motion language for state changes: swap, pop, reveal, card entrance. */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const SWAP_TRANSITION: Transition = { duration: 0.22, ease: EASE_OUT };

/**
 * SWAP's targets. With reduced motion the 4px blur is left out: MotionConfig reducedMotion="user" only skips transforms
 * (the 8px slide), a filter would still animate. What remains is a plain fade.
 */
export function swapPreset(reduced: boolean) {
  const blur = (px: number) => (reduced ? {} : { filter: `blur(${px}px)` });
  return {
    initial: { opacity: 0, y: 8, ...blur(4) },
    animate: { opacity: 1, y: 0, ...blur(0) },
    exit: { opacity: 0, y: -8, ...blur(4) },
    transition: SWAP_TRANSITION,
  } satisfies { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition };
}

/**
 * A swap preset whose targets follow `isReduced()` each time they are read. Spreading it (`{...SWAP}`) calls the getters,
 * so every render picks the full or the reduced targets as the OS setting is now, not as it was when the app loaded.
 */
export function liveSwapPreset(isReduced: () => boolean) {
  const full = swapPreset(false);
  const reduced = swapPreset(true);
  const current = () => (isReduced() ? reduced : full);
  return {
    get initial() {
      return current().initial;
    },
    get animate() {
      return current().animate;
    },
    get exit() {
      return current().exit;
    },
    transition: SWAP_TRANSITION,
  };
}

/** The OS reduced-motion setting, kept current by its media query's change event (no window in tests: off) */
const reducedQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let prefersReducedMotion = reducedQuery?.matches ?? false;
reducedQuery?.addEventListener?.('change', (event) => {
  prefersReducedMotion = event.matches;
});

/**
 * One state's content replaced by another; use inside `<AnimatePresence mode="wait" initial={false}>`, keyed by the state.
 * Spread it in render (`{...SWAP}`): the blur follows the OS setting live (swapPreset).
 */
export const SWAP = liveSwapPreset(() => prefersReducedMotion);

export const POP_SPRING: Transition = { type: 'spring', stiffness: 420, damping: 24 };

/** Layout moves (chips and bar segments sliding to their new place) */
export const LAYOUT_SPRING: Transition = { type: 'spring', stiffness: 380, damping: 34 };

/** Badges and the avatar circle */
export const POP = {
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.6, opacity: 0, transition: { duration: 0.15 } },
  transition: POP_SPRING,
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition };

const REVEAL_DURATION = 0.2;
export const REVEAL_TRANSITION: Transition = { duration: REVEAL_DURATION, ease: EASE_OUT };

/**
 * Reveal's height + opacity transition. Reduced motion: the height settles at once (no sliding content below) and only
 * the fade remains; folding away, the height waits for the fade so the line doesn't vanish before it has faded.
 */
export function revealTransition(reduced: boolean, phase: 'enter' | 'exit'): Transition {
  if (!reduced) return REVEAL_TRANSITION;
  const height = phase === 'enter' ? { duration: 0 } : { duration: 0, delay: REVEAL_DURATION };
  return { ...REVEAL_TRANSITION, height };
}

/** Login, invite and herstel cards on first mount */
export const CARD_ENTER = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: EASE_OUT },
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition };

/** Text that follows a badge: fades up once the badge has popped */
export function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: EASE_OUT, delay },
  } satisfies { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition };
}

/** Phone windows (Beheer): the list slides out one way and the pane in from the other (and back); custom = direction */
export const PANE_SLIDE = {
  enter: (direction: number) => ({ opacity: 0, x: 24 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: -24 * direction }),
};
export const PANE_SLIDE_TRANSITION: Transition = { duration: 0.22, ease: EASE_OUT };
