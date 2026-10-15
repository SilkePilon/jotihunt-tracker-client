import { useRef, useState } from 'react';

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
