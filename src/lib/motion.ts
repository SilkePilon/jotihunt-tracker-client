import type { TargetAndTransition, Transition } from 'motion/react';

/** Shared motion language for state changes: swap, pop, reveal, card entrance. */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const SWAP_TRANSITION: Transition = { duration: 0.22, ease: EASE_OUT };

/** One state's content replaced by another; use inside `<AnimatePresence mode="wait" initial={false}>`, keyed by the state */
export const SWAP = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
  transition: SWAP_TRANSITION,
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition };

export const POP_SPRING: Transition = { type: 'spring', stiffness: 420, damping: 24 };

/** Badges and the avatar circle */
export const POP = {
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.6, opacity: 0, transition: { duration: 0.15 } },
  transition: POP_SPRING,
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition };

export const REVEAL_TRANSITION: Transition = { duration: 0.2, ease: EASE_OUT };

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
