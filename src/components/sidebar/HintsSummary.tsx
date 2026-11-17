import { AnimatePresence, motion } from 'motion/react';
import { useHintBoard } from '@/hooks/hints.hook';
import { useNextHint } from '@/hooks/next-hint.hook';
import { cn } from '@/lib/cn';
import { hintProgress } from '@/lib/hints';
import { SWAP } from '@/lib/motion';
import { hintSummaryCountdown } from '@/lib/next-hint';

/**
 * The collapsed Hints summary (laptop section header, phone menu row): "3/6 opgelost · hint over 12:34". Its own component
 * so only this line re-renders with the countdown's 1 s tick. The countdown part swaps in and out with its state (not
 * every second) and turns amber in the last five minutes.
 */
export default function HintsSummary() {
  const { board } = useHintBoard();
  const progress = board ? hintProgress(board) : undefined;
  const next = useNextHint();
  const countdown = hintSummaryCountdown(next);
  if (!progress && !countdown) return null;
  const mode = next.isNewHint ? 'new' : 'countdown';
  return (
    // Fades in when its first poll answers (the header/row keeps its height), like the Vossen summary
    <motion.span className="tabular-nums" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      {progress && `${progress.solved}/${progress.total} opgelost`}
      <AnimatePresence mode="wait" initial={false}>
        {countdown && (
          <motion.span
            key={mode}
            {...SWAP}
            className={cn('inline-block transition-colors duration-300', (next.isUrgent || next.isNewHint) && 'text-status-warn-text')}
          >
            {progress && <span aria-hidden className="mx-1">·</span>}
            {countdown}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
}
