import { AnimatePresence, motion } from 'motion/react';
import { useEdition } from '@/hooks/edition.hook';
import { POP } from '@/lib/motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Grey year badge while an archive edition is shown (design I1). */
export default function EditionBadge() {
  const { state } = useEdition();
  const year = state?.readOnly ? state.shownYear : null;

  return (
    <AnimatePresence initial={false}>
      {year !== null && (
        <motion.span key={year} className="inline-grid shrink-0" {...POP}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="rounded-badge bg-muted px-2 py-0.5 text-xs font-bold tracking-wide text-muted-foreground tabular-nums">{year}</span>
            </TooltipTrigger>
            <TooltipContent>Archief — alleen-lezen</TooltipContent>
          </Tooltip>
        </motion.span>
      )}
    </AnimatePresence>
  );
}
