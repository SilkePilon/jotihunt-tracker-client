import { AnimatePresence, motion } from 'motion/react';
import { CircleCheckIcon, CircleHelpIcon, KeyboardIcon, ListChecksIcon, TriangleAlertIcon } from 'lucide-react';
import type { GuessStatus } from '@/lib/hint-guess';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type CoordinateState = 'idle' | 'inside' | 'outside';

const STATES = {
  idle: { Icon: KeyboardIcon, text: 'Tik op de vakjes om te typen', className: 'text-muted-foreground' },
  inside: { Icon: CircleCheckIcon, text: 'Ligt in Nederland', className: 'text-fox-ok' },
  outside: { Icon: TriangleAlertIcon, text: 'Buiten Nederland', className: 'text-fox-error' },
} as const;

/**
 * Live check under the digit boxes: typing hint, inside the Netherlands, outside, or (with a '?') the guess line.
 * `missing` (coordinates fine, area or time not chosen yet) replaces "Ligt in Nederland" with what Registreren waits for.
 */
export default function CoordinateStatus({ state, guess, missing }: { state: CoordinateState; guess?: GuessStatus | null; missing?: string | null }) {
  // The card shows the map instruction too (" · tik er een op de kaart")
  const guessText = guess ? guess.text + (guess.action ?? '') : '';
  const view = guess
    ? guess.tone === 'warn'
      ? { Icon: TriangleAlertIcon, text: guessText, className: 'text-fox-error' }
      : { Icon: CircleHelpIcon, text: guessText, className: 'text-on-guess-container' }
    : state === 'inside' && missing
      ? { Icon: ListChecksIcon, text: missing, className: 'text-primary-text' }
      : STATES[state];
  const { Icon, text, className } = view;
  return (
    <p role="status" aria-live="polite" className="min-w-0 flex-1 text-xs font-medium desk:text-[11px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={text} {...SWAP} className={cn('inline-flex items-center gap-1.5', className)}>
          <Icon aria-hidden className="size-3 shrink-0" />
          {text}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}
