import { useEffect, useState } from 'react';
import { createIdleTracker } from '@/lib/idle';

/** Whether the mouse has been still for `idleMs` (true from the start, false while it moves): for hiding the cursor. */
export function useIdleCursor(idleMs: number): boolean {
  const [idle, setIdle] = useState(true);
  useEffect(() => {
    const tracker = createIdleTracker(idleMs, setIdle);
    const onMove = () => tracker.poke();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onMove);
      tracker.dispose();
    };
  }, [idleMs]);
  return idle;
}
