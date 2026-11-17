import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useEdition } from '@/hooks/edition.hook';
import { POP } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Grey year badge while an archive edition is shown (design I1); a tap toggles its tooltip (phones have no hover). */
export default function EditionBadge() {
  const { state } = useEdition();
  const year = state?.readOnly ? state.shownYear : null;
  const [open, setOpen] = useState(false);
  // Radix closes a tooltip on pointerdown of its trigger; remember the state before that so a tap toggles (PredictionList)
  const wasOpen = useRef(false);

  return (
    <AnimatePresence initial={false}>
      {year !== null && (
        // isolate: the 44px touch area (COARSE_HIT_AREA) stays above the header's background
        <motion.span key={year} className="isolate inline-grid shrink-0" {...POP}>
          <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Archief ${year} — alleen-lezen`}
                onPointerDown={() => (wasOpen.current = open)}
                // Enter/Space (detail 0) toggles from the current state
                onClick={(event) => setOpen(event.detail === 0 ? !open : !wasOpen.current)}
                className={cn(
                  COARSE_HIT_AREA,
                  'cursor-default rounded-badge bg-muted px-2 py-0.5 text-xs font-bold tracking-wide text-muted-foreground tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
              >
                {year}
              </button>
            </TooltipTrigger>
            <TooltipContent>Archief — alleen-lezen</TooltipContent>
          </Tooltip>
        </motion.span>
      )}
    </AnimatePresence>
  );
}
