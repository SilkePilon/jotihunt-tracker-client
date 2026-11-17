import { useEffect, useState } from 'react';
import { RefreshCwIcon, WifiOffIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { connectionProblem, connectionSnapshot, problemLabel, reportResume } from '@/lib/connection';
import { problemAnnouncement } from '@/lib/stale-announcement';
import { SWAP_TRANSITION } from '@/lib/motion';
import { usePublishTopHeight } from '@/stores/top-stack.store';
import { cn } from '@/lib/utils';

const CHECK_MS = 5000;

/**
 * Small notice when polled data hasn't refreshed for a while (offline, server down, hung requests), or when one of the
 * critical feeds (vossen, hunts, …) keeps failing while the rest refreshes; gone after the next successful poll.
 * Offline before anything loaded shows at once. Screen readers get a separate, always-mounted polite region without the
 * age, so the first problem is read out and a ticking age is not re-announced every minute.
 */
export default function StaleDataBadge() {
  const [label, setLabel] = useState<string | null>(null);
  // 'neutral': back from the background with old data, catching up (not an error)
  const [tone, setTone] = useState<'error' | 'neutral'>('error');
  // Strings, so a check that finds the same problem doesn't re-render
  const [announcement, setAnnouncement] = useState('');
  // The happy-hour pill, the drawing toolbar and (phones) toasts stack below the badge (one or two lines, lib/top-stack.ts)
  const measureRef = usePublishTopHeight('badge', label !== null);

  useEffect(() => {
    const check = () => {
      const problem = connectionProblem(connectionSnapshot(), navigator.onLine, Date.now());
      setLabel(problem ? problemLabel(problem) : null);
      setTone(problem?.refreshing ? 'neutral' : 'error');
      setAnnouncement(problemAnnouncement(problem));
    };
    // Back in front (tab switch, phone unlocked, back/forward cache): say the data is catching up right away, and check
    // more often until it has (SWR refreshes on focus)
    let followUp: ReturnType<typeof setTimeout> | undefined;
    const resume = () => {
      if (document.visibilityState !== 'visible') return;
      reportResume();
      check();
      clearTimeout(followUp);
      followUp = setTimeout(check, 1000);
    };
    check();
    const interval = setInterval(check, CHECK_MS);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      clearInterval(interval);
      clearTimeout(followUp);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, []);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <AnimatePresence>
        {label !== null && (
          <motion.div
            key="stale"
            ref={measureRef}
            // Read out through the region above (without the minute-by-minute age)
            aria-hidden
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SWAP_TRANSITION}
            // Centred through motion's x, since motion owns the transform. md+: centred over the map area right of the
            // 320px sidebar (left 8px + 320px, like the happy-hour pill in App.tsx), so it never covers the sidebar, and
            // below the search / coordinates row (lib/top-stack.ts DESKTOP_PILL_TOP, 52px; the pill stacks under it)
            // Phones: centred over the map; held sideways that is the part right of the sheet column (--sheet-side, set
            // by BottomSheet; 0px upright, so plain centred)
            style={{ x: '-50%' }}
            className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] md:top-[calc(env(safe-area-inset-top)+52px)] z-50 flex w-max max-w-[min(calc(100vw-32px),420px)] items-center md:left-[calc(50%+164px)] md:max-w-[min(calc(100vw-360px),420px)] shell-mobile:top-[calc(env(safe-area-inset-top)+8px)] shell-mobile:left-[calc(var(--sheet-side,0px)_+_(100vw_-_var(--sheet-side,0px))_/_2)] shell-mobile:max-w-[min(calc(100vw_-_var(--sheet-side,0px)_-_32px),420px)] gap-2 rounded-full bg-fox-error-container py-1.5 pr-3.5 pl-2.5 text-[13px] font-bold text-fox-on-error shadow-(--shadow-tile)"
          >
            {/* Round tonal pill like the happy-hour pill: dark red on the light red container (7.2:1, both themes). Neutral tone: a tonal layer over the error fill (under the content, in the badge's own stacking context),
                faded in and out, so swapping tone animates and the shell keeps one look */}
            <AnimatePresence initial={false}>
              {tone === 'neutral' && (
                <motion.span key="neutral" aria-hidden className="absolute inset-0 -z-10 rounded-[inherit] bg-beheer-row-high" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SWAP_TRANSITION} />
              )}
            </AnimatePresence>
            {tone === 'neutral' ? <RefreshCwIcon className="size-4 shrink-0 text-foreground motion-safe:animate-spin" /> : <WifiOffIcon className="size-4 shrink-0" />}
            {/* Wraps to a second line on narrow phones instead of cutting off the feed or the age */}
            <span className={cn('min-w-0 text-center leading-snug text-balance transition-colors', tone === 'neutral' && 'text-foreground')}>{label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
