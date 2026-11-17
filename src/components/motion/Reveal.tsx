import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { revealTransition } from '@/lib/motion';

interface RevealProps {
  /** Shown while truthy; the last content stays on screen while it folds away */
  children: ReactNode;
  /** The parent's flex gap in px: folded away it takes no space, so the line below does not jump by a gap */
  gap?: number;
}

/** An inline line (error, hint) that unfolds in and folds away instead of popping. */
export default function Reveal({ children, gap = 0 }: RevealProps) {
  // Reduced motion: the line takes (or gives back) its room at once and only fades; MotionConfig's "user" setting skips
  // transforms but would still animate the height, which moves everything below it
  const reduced = useReducedMotion() ?? false;
  return (
    <AnimatePresence initial={false}>
      {children ? (
        <motion.div
          key="reveal"
          className="overflow-hidden"
          style={{ marginTop: -gap }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: revealTransition(reduced, 'exit') }}
          transition={revealTransition(reduced, 'enter')}
        >
          <div style={{ paddingTop: gap }}>{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
