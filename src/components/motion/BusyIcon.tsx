import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon } from 'lucide-react';
import { SWAP_TRANSITION } from '@/lib/motion';

interface BusyIconProps {
  /** Show the spinner instead of `icon` */
  busy: boolean;
  /** The button's resting icon; without one the spinner unfolds in and out of nothing */
  icon?: ReactNode;
}

/**
 * A button's leading icon that swaps to a spinner while its request runs (scale + fade, never a pop). Inherits the
 * button's icon size via `[&_svg]` rules.
 */
export default function BusyIcon({ busy, icon }: BusyIconProps) {
  if (icon === undefined) {
    return (
      <AnimatePresence initial={false}>
        {busy && (
          <motion.span
            key="busy"
            className="inline-flex overflow-hidden"
            initial={{ opacity: 0, width: 0, scale: 0.6 }}
            animate={{ opacity: 1, width: 'auto', scale: 1 }}
            exit={{ opacity: 0, width: 0, scale: 0.6 }}
            transition={SWAP_TRANSITION}
          >
            <Loader2Icon className="animate-spin" />
          </motion.span>
        )}
      </AnimatePresence>
    );
  }
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={busy ? 'busy' : 'idle'} className="inline-flex" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SWAP_TRANSITION}>
        {busy ? <Loader2Icon className="animate-spin" /> : icon}
      </motion.span>
    </AnimatePresence>
  );
}
