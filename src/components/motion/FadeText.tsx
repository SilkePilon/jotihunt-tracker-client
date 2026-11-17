import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SWAP } from '@/lib/motion';

/** Text that swaps (the shared SWAP) when `swapKey` changes, not on every tick of its content. */
export default function FadeText({ swapKey, className, children }: { swapKey: string; className?: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p key={swapKey} className={className} {...SWAP}>
        {children}
      </motion.p>
    </AnimatePresence>
  );
}
