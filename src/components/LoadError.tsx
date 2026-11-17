import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, RotateCwIcon } from 'lucide-react';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface LoadErrorProps {
  /** What failed, e.g. "Hints konden niet worden geladen." */
  message: string;
  /** Refetch (e.g. SWR's mutate); the button spins until it settles */
  onRetry: () => Promise<unknown> | unknown;
  /** Centre the line and button (an empty list's spot) instead of left-aligned (a card body) */
  centered?: boolean;
  className?: string;
}

/**
 * Inline "couldn't load" state for a first load that failed (no data to show yet): a muted line and a small tonal
 * "Opnieuw proberen" button. Not for a later poll that fails while older data is still on screen (the stale badge
 * covers that).
 */
export default function LoadError({ message, onRetry, centered, className }: LoadErrorProps) {
  const [busy, setBusy] = useState(false);

  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      await onRetry();
    } catch {
      // The data hook keeps the error; this state stays
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground', centered && 'flex-col justify-center text-center', className)}>
      <span className="min-w-0">{message}</span>
      <motion.button
        type="button"
        layout
        style={{ borderRadius: 12 }}
        disabled={busy}
        aria-busy={busy}
        onClick={() => void retry()}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 bg-beheer-row-high px-3 text-[12.5px] font-semibold text-foreground outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))] focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-70 [&_svg]:size-3.5"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={busy ? 'busy' : 'idle'} className="inline-flex" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SWAP_TRANSITION}>
            {busy ? <Loader2Icon className="animate-spin" /> : <RotateCwIcon />}
          </motion.span>
        </AnimatePresence>
        Opnieuw proberen
      </motion.button>
    </div>
  );
}
