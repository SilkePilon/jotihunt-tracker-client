import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import CookieBadge from '@/components/tracker/CookieBadge';
import SuccessBadge from '@/components/auth/SuccessBadge';
import { EASE_OUT } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';
import type { AreaState } from '@/types/Intel';

const TITLE: Record<AreaState, string> = { solved: 'opgelost', open: 'nog open', none: 'geen hint', missing: 'geen hint' };

/** Area status chip in the wide timeline: dot + name, a green cookie check when solved, dimmed without a hint. Status only. */
export function AreaChip({ area, state, label }: { area: string; state: AreaState; label: string }) {
  const dim = state === 'none' || state === 'missing';
  // A chip mounted already solved shows the static badge; one that gets solved while on screen pops its check in.
  // Derived during render (not in an effect), so a chip that goes back to open and is solved again pops again.
  const [poppable, setPoppable] = useState(state !== 'solved');
  if (state !== 'solved' && !poppable) setPoppable(true);
  return (
    <span
      title={`${label}: ${TITLE[state]}`}
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 rounded-[9px] bg-beheer-row pr-2.5 pl-2 text-xs font-semibold transition-[padding,opacity] duration-200',
        state === 'solved' && 'pr-1.5',
        dim && 'opacity-40',
      )}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} aria-hidden />
      {label}
      <AnimatePresence initial={false}>
        {state === 'solved' && (
          // Grows from zero width (its 6px lead replaces the flex gap) so the chip widens instead of jumping
          <motion.span
            key="ok"
            className="-ml-1.5 inline-flex items-center justify-end self-stretch overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: 22 }}
            exit={{ width: 0, opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            {poppable ? <SuccessBadge size={16} /> : <CookieBadge tone="ok" size={16} />}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
