import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, RotateCwIcon } from 'lucide-react';
import { SWAP_TRANSITION } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn } from '@/lib/utils';

interface LoadErrorProps {
  /** What failed, e.g. "Hints konden niet worden geladen." */
  message: string;
  /** Refetch (e.g. SWR's mutate); the button spins until it settles */
  onRetry: () => Promise<unknown> | unknown;
  /** Centre the line and button (an empty list's spot) instead of left-aligned (a card body) */
  centered?: boolean;
  /** HQ wall: the button sizes in rem, so it grows with the wall's viewport-scaled root font like the text around it */
  scale?: boolean;
  /** The failure blocks what the user is doing (e.g. hint entry without the markers): announced at once as an alert */
  blocking?: boolean;
  className?: string;
}

/**
 * Inline "couldn't load" state for a first load that failed (no data to show yet): a muted line and a small tonal
 * "Opnieuw proberen" button. Not for a later poll that fails while older data is still on screen (the stale badge
 * covers that).
 */
export default function LoadError({ message, onRetry, centered, scale, blocking, className }: LoadErrorProps) {
  const [busy, setBusy] = useState(false);
  // A polite status region mounted with its text in it is often not read: it mounts empty and gets the message a frame
  // later (a screen-reader-only copy, so the visible line doesn't flicker). Blocking failures use role="alert" instead
  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    if (blocking) return;
    const frame = requestAnimationFrame(() => setAnnounced(message));
    return () => cancelAnimationFrame(frame);
  }, [message, blocking]);

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
    // Only the message is the status: the retry button (and its spinner swap) isn't re-read with it
    <div className={cn('isolate flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground', centered && 'flex-col justify-center text-center', className)}>
      {blocking ? (
        <span role="alert" className="min-w-0">
          {message}
        </span>
      ) : (
        <>
          <span aria-hidden className="min-w-0">
            {message}
          </span>
          <span role="status" className="sr-only">
            {announced}
          </span>
        </>
      )}
      <motion.button
        type="button"
        layout
        style={{ borderRadius: scale ? '0.75rem' : 12 }}
        // aria-disabled, not disabled, while retrying: the button keeps the focus (retry() ignores repeat taps)
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={() => void retry()}
        className={cn(
          'inline-flex shrink-0 items-center bg-beheer-row-high font-semibold text-foreground outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))] focus-visible:ring-[3px] focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-70',
          scale ? 'h-[2.25rem] gap-[0.4rem] px-[0.85rem] text-[0.875rem] [&_svg]:size-[1.1rem]' : 'h-8 gap-1.5 px-3 text-caption [&_svg]:size-4',
          // 44px touch area on phones, same look
          COARSE_HIT_AREA,
        )}
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
