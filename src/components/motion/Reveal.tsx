import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { REVEAL_TRANSITION } from '@/lib/motion';

interface RevealProps {
  /** Shown while truthy; the last content stays on screen while it folds away */
  children: ReactNode;
  /** The parent's flex gap in px: folded away it takes no space, so the line below does not jump by a gap */
  gap?: number;
}

/** An inline line (error, hint) that unfolds in and folds away instead of popping. */
export default function Reveal({ children, gap = 0 }: RevealProps) {
  return (
    <AnimatePresence initial={false}>
      {children ? (
        <motion.div
          key="reveal"
          className="overflow-hidden"
          style={{ marginTop: -gap }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={REVEAL_TRANSITION}
        >
          <div style={{ paddingTop: gap }}>{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
