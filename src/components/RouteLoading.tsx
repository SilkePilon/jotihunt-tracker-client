import { motion } from 'motion/react';
import { Loader2Icon } from 'lucide-react';
import { EASE_OUT } from '@/lib/motion';

/** How long a page may take to load before the loading screen fades in: a warm cache never flashes it */
export const ROUTE_LOADING_DELAY_S = 0.3;

/**
 * Suspense fallback while a page's chunk downloads (slow cold start): the app background with the logo and a subtle
 * spinner, fading in only after a short delay.
 */
export default function RouteLoading() {
  return (
    <div role="status" aria-label="Laden" className="grid h-svh place-items-center bg-background">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE_OUT, delay: ROUTE_LOADING_DELAY_S }}
      >
        <img src="/logo.svg" alt="" className="size-14" />
        <Loader2Icon aria-hidden className="size-5 animate-spin text-muted-foreground" />
      </motion.div>
    </div>
  );
}
