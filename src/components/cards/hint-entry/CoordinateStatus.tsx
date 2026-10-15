import { AnimatePresence, motion } from 'motion/react';
import { CircleCheckIcon, KeyboardIcon, TriangleAlertIcon } from 'lucide-react';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type CoordinateState = 'idle' | 'inside' | 'outside';

const STATES = {
  idle: { Icon: KeyboardIcon, text: 'Tik op de vakjes om te typen', className: 'text-muted-foreground' },
  inside: { Icon: CircleCheckIcon, text: 'Ligt in Nederland', className: 'text-fox-ok' },
  outside: { Icon: TriangleAlertIcon, text: 'Buiten Nederland — controleer X en Y', className: 'text-fox-error' },
} as const;

/** Live check under the digit boxes: typing hint, inside the Netherlands, or outside. */
export default function CoordinateStatus({ state }: { state: CoordinateState }) {
  const { Icon, text, className } = STATES[state];
  return (
    <p role="status" aria-live="polite" className="min-w-0 flex-1 text-xs font-medium">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} {...SWAP} className={cn('inline-flex items-center gap-1.5', className)}>
          <Icon aria-hidden className="size-3.5 shrink-0" />
          {text}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}
