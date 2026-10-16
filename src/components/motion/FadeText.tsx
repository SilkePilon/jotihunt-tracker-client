import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/** Text that cross-fades when `swapKey` changes (not on every tick of its content). */
export default function FadeText({ swapKey, className, children }: { swapKey: string; className?: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p key={swapKey} className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
        {children}
      </motion.p>
    </AnimatePresence>
  );
}
