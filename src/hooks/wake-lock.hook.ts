import { useEffect } from 'react';
import { createWakeLock } from '@/lib/wake-lock';

/** Keeps the screen on while `active` (where supported), also after the page was hidden and shown again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const lock = createWakeLock();
    lock.start();
    return () => lock.stop();
  }, [active]);
}
