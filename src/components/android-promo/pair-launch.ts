import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { appDidNotOpen } from '@/lib/android-promo';

export type PairPhase = 'opening' | 'waiting' | 'failed' | 'error';

/**
 * One pairing attempt, started from the user's tap (Chrome only follows a custom-scheme link shortly after a user
 * gesture): create the code, then navigate to the deep link right away. `startedAt` is the moment of navigation;
 * the "app didn't open" check counts from there. `createUrl` returns the deep link, or null when the code failed.
 * `stillWanted` is checked before navigating: the dialog may have closed while the request was pending.
 */
export function usePairLaunch(createUrl: () => Promise<string | null>, stillWanted: () => boolean) {
  const [phase, setPhase] = useState<PairPhase>('opening');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // A newer attempt (or leaving the step) makes an older pending request stale
  const run = useRef(0);
  const start = () => {
    const id = ++run.current;
    setPhase('opening');
    setStartedAt(null);
    void createUrl().then((url) => {
      if (id !== run.current || !stillWanted()) return;
      if (!url) {
        setPhase('error');
        return;
      }
      setStartedAt(Date.now());
      window.location.href = url;
    });
  };
  return { phase, setPhase, startedAt, start };
}

/**
 * After the deep link was opened (`startedAt`): still visible 2.5 s later = the app didn't open ('failed'); hidden and
 * back again = the app opened and the page waits for it ('waiting'). Only while the attempt is 'opening'.
 */
export function useAppOpenCheck(phase: PairPhase, startedAt: number | null, onPhase: (phase: PairPhase) => void) {
  const setPhase = useEffectEvent(onPhase);
  useEffect(() => {
    if (phase !== 'opening' || startedAt === null) return;
    const id = window.setInterval(() => {
      if (appDidNotOpen(startedAt, Date.now(), document.visibilityState === 'visible')) setPhase('failed');
    }, 250);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setPhase('waiting');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, startedAt]);
}
