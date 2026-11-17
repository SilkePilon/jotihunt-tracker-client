import { useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import AutoHeight from '@/components/motion/AutoHeight';
import { focusDropped } from '@/lib/focus';
import { CARD_ENTER, SWAP } from '@/lib/motion';

/**
 * The card area of the invite and herstel pages: slides up on first mount, swaps between states (loading, form,
 * welcome, link gone) and follows the new card's height so the credits below do not jump. When the old scene took
 * focus with it (e.g. the submit button of the form that turned into the welcome card), the new scene's heading gets
 * it, so keyboard and screen-reader users land on what changed.
 */
export default function AuthSwap({ scene, children }: { scene: string; children: ReactNode }) {
  const current = useRef<HTMLDivElement>(null);

  function focusHeading() {
    // The next frame: the arriving scene mounts right after the old one finished leaving
    requestAnimationFrame(() => {
      const heading = current.current?.querySelector<HTMLElement>('h1, h2');
      if (!heading || !focusDropped(document.activeElement, document.body)) return;
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
  }

  return (
    <motion.div className="flex w-full flex-col items-center" {...CARD_ENTER}>
      {/* The padding plus matching negative margin keeps the card's shadow out of the clip while scenes swap */}
      <AutoHeight scene={scene} className="-m-4 self-stretch" innerClassName="flex flex-col items-center p-4">
        <AnimatePresence mode="wait" initial={false} onExitComplete={focusHeading}>
          {/* A heading focused by script shows no ring (it isn't a control) */}
          <motion.div ref={current} key={scene} className="flex w-full flex-col items-center [&_:is(h1,h2)]:outline-none" {...SWAP}>
            {children}
          </motion.div>
        </AnimatePresence>
      </AutoHeight>
    </motion.div>
  );
}
