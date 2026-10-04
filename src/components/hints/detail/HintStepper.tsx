import { Fragment } from 'react';
import { CheckIcon, TriangleAlertIcon } from 'lucide-react';
import { HintCell } from '@/types/HintCell';
import { hintStep, HintStepNumber } from '@/lib/hints';
import { cn } from '@/lib/utils';
import { STEP_LABELS, STEPS } from './hint-detail.utils';

/**
 * Claim → solve → check progress as three badges joined by lines. Sized for the 360 px pane of the hints page (327 px
 * for the list): the lines take what is left and shrink to 4 px, and a label is cut with an ellipsis before the row
 * overflows.
 */
export default function HintStepper({ cell }: { cell: HintCell }) {
  const step = hintStep(cell);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Voortgang">
      {STEPS.map((number) => {
        const done = step.done.includes(number);
        const current = !done && step.current === number;
        const disputed = number === 3 && step.checkState === 'disputed';
        return (
          <Fragment key={number}>
            {number > 1 && <li aria-hidden className={cn('h-px min-w-1 flex-1', step.done.includes((number - 1) as HintStepNumber) ? 'bg-green-500' : 'bg-border')} />}
            <li
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-center gap-1 rounded-badge border px-2 py-1 text-xs font-medium',
                done && 'border-green-600 bg-green-600 text-white dark:border-green-700 dark:bg-green-700',
                current && !disputed && 'border-primary bg-primary/10 text-primary',
                current && disputed && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                !done && !current && 'border-border text-muted-foreground',
              )}
            >
              {done ? (
                <CheckIcon className="size-3.5 shrink-0" />
              ) : disputed ? (
                <TriangleAlertIcon className="size-3.5 shrink-0" />
              ) : (
                <span className="shrink-0 font-mono">{number}</span>
              )}
              <span className="truncate">{disputed ? 'Twijfel' : STEP_LABELS[number]}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
