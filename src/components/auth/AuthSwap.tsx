import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import AutoHeight from '@/components/motion/AutoHeight';
import { CARD_ENTER, SWAP } from '@/lib/motion';

/**
 * The card area of the invite and herstel pages: slides up on first mount, swaps between states (loading, form,
 * welcome, link gone) and follows the new card's height so the credits below do not jump.
 */
export default function AuthSwap({ scene, children }: { scene: string; children: ReactNode }) {
  return (
    <motion.div className="flex w-full flex-col items-center" {...CARD_ENTER}>
      {/* The padding plus matching negative margin keeps the card's shadow out of the clip while scenes swap */}
      <AutoHeight scene={scene} className="-m-4 self-stretch" innerClassName="flex flex-col items-center p-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={scene} className="flex w-full flex-col items-center" {...SWAP}>
            {children}
          </motion.div>
        </AnimatePresence>
      </AutoHeight>
    </motion.div>
  );
}
