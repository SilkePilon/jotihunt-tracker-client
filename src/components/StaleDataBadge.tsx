import { useEffect, useState } from 'react';
import { WifiOffIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { connectionProblem, connectionSnapshot, problemLabel } from '@/lib/connection';
import { SWAP_TRANSITION } from '@/lib/motion';

const CHECK_MS = 5000;

/**
 * Small notice when polled data hasn't refreshed for a while (offline, server down, hung requests), or when one of the
 * critical feeds (vossen, hunts, …) keeps failing while the rest refreshes; gone after the next successful poll.
 * Offline before anything loaded shows at once.
 */
export default function StaleDataBadge() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const problem = connectionProblem(connectionSnapshot(), navigator.onLine, Date.now());
      setLabel(problem ? problemLabel(problem) : null);
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
    <AnimatePresence>
      {label !== null && (
        <motion.div
          key="stale"
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SWAP_TRANSITION}
          // Centred through motion's x, since motion owns the transform
          style={{ x: '-50%' }}
          className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-50 flex items-center gap-1.5 whitespace-nowrap rounded-badge bg-destructive px-2.5 py-1 text-xs font-semibold text-white shadow-md"
        >
          <WifiOffIcon className="size-3.5 shrink-0" />
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
