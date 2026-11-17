import { useEffect, useState } from 'react';
import { WifiOffIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { connectionProblem, connectionSnapshot, problemLabel } from '@/lib/connection';
import { problemAnnouncement } from '@/lib/stale-announcement';
import { SWAP_TRANSITION } from '@/lib/motion';
import { usePublishTopHeight } from '@/stores/top-stack.store';

const CHECK_MS = 5000;

/**
 * Small notice when polled data hasn't refreshed for a while (offline, server down, hung requests), or when one of the
 * critical feeds (vossen, hunts, …) keeps failing while the rest refreshes; gone after the next successful poll.
 * Offline before anything loaded shows at once. Screen readers get a separate, always-mounted polite region without the
 * age, so the first problem is read out and a ticking age is not re-announced every minute.
 */
export default function StaleDataBadge() {
  const [label, setLabel] = useState<string | null>(null);
  // Strings, so a check that finds the same problem doesn't re-render
  const [announcement, setAnnouncement] = useState('');
  // Phones: the happy-hour pill, the drawing toolbar and toasts stack below the badge (one or two lines, lib/top-stack.ts)
  const measureRef = usePublishTopHeight('badge', label !== null);

  useEffect(() => {
    const check = () => {
      const problem = connectionProblem(connectionSnapshot(), navigator.onLine, Date.now());
      setLabel(problem ? problemLabel(problem) : null);
      setAnnouncement(problemAnnouncement(problem));
    };
    check();
    const interval = setInterval(check, CHECK_MS);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
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
            // 320px sidebar (left 8px + 320px, like the happy-hour pill in App.tsx), so it never covers the sidebar
            style={{ x: '-50%' }}
            className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-50 flex w-max max-w-[min(calc(100vw-32px),420px)] items-center md:left-[calc(50%+164px)] md:max-w-[min(calc(100vw-360px),420px)] gap-2 rounded-full bg-fox-error-container py-1.5 pr-3.5 pl-2.5 text-[13px] font-bold text-fox-on-error shadow-md"
          >
            {/* Round tonal pill like the happy-hour pill: dark red on the light red container (7.2:1, both themes) */}
            <WifiOffIcon className="size-4 shrink-0" />
            {/* Wraps to a second line on narrow phones instead of cutting off the feed or the age */}
            <span className="min-w-0 text-center leading-snug text-balance">{label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
