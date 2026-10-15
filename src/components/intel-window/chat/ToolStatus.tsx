import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { SWAP_TRANSITION } from '@/lib/motion';

/** M3: one line while the AI works (spinner + the running tool's label); the text swaps, the line folds in and away */
export default function ToolStatus({ label }: { label: string | null }) {
  return (
    <Reveal>
      {label && (
        <div className="mx-1 flex items-center gap-2 py-0.5 text-[12.5px]" role="status">
          <Loader2Icon className="size-3.5 shrink-0 animate-spin text-fox-warn" aria-hidden />
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
  );
}
