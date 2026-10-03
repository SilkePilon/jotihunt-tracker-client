import { Fragment } from 'react';
import { CheckIcon, TriangleAlertIcon } from 'lucide-react';
import { HintCell } from '@/types/HintCell';
import { hintStep, HintStepNumber } from '@/lib/hints';
import { cn } from '@/lib/utils';
import { STEP_LABELS, STEPS } from './hint-detail.utils';

/**
 * Claim → solve → check progress as three badges joined by lines.
 */
export default function HintStepper({ cell }: { cell: HintCell }) {
  const step = hintStep(cell);
  return (
    <ol className="flex items-center gap-2" aria-label="Voortgang">
      {STEPS.map((number) => {
        const done = step.done.includes(number);
        const current = !done && step.current === number;
        const disputed = number === 3 && step.checkState === 'disputed';
        return (
          <Fragment key={number}>
            {number > 1 && <li aria-hidden className={cn('h-px min-w-3 flex-1', step.done.includes((number - 1) as HintStepNumber) ? 'bg-green-500' : 'bg-border')} />}
            <li
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-badge border px-2.5 py-1 text-xs font-medium',
                done && 'border-green-600 bg-green-600 text-white dark:border-green-700 dark:bg-green-700',
                current && !disputed && 'border-primary bg-primary/10 text-primary',
                current && disputed && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                !done && !current && 'border-border text-muted-foreground',
              )}
            >
              {done ? (
                <CheckIcon className="size-3.5" />
              ) : disputed ? (
                <TriangleAlertIcon className="size-3.5" />
              ) : (
                <span className="font-mono">{number}</span>
              )}
              {disputed ? 'Twijfel' : STEP_LABELS[number]}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
