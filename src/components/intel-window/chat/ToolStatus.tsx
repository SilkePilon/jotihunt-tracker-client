import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { SWAP_TRANSITION } from '@/lib/motion';

/**
 * M3: one line while the AI works (spinner + the running tool's label); the text swaps, the line folds in and away.
 * The animated labels are hidden from screen readers (old and new would both be read during the swap); a status region
 * that is always mounted (a region that mounts with its first text isn't reliably announced) carries the current label.
 * It is sr-only, i.e. absolutely positioned, so it adds no gap in the thread's flex column.
 */
export default function ToolStatus({ label }: { label: string | null }) {
  return (
    <>
      <span role="status" className="sr-only">
        {label ?? ''}
      </span>
      <Reveal>
        {label && (
          <div className="mx-1 flex items-center gap-2 py-0.5 text-caption" aria-hidden>
            <Loader2Icon className="size-3.5 shrink-0 animate-spin text-fox-warn" />
            <span className="relative min-w-0">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={label} className="ai-shimmer inline-block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SWAP_TRANSITION}>
                  {label}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        )}
      </Reveal>
    </>
  );
}
