/** The bits of the Screen Wake Lock API used here (feature-detected: older Safari and Firefox lack it). */
interface Sentinel {
  released: boolean;
  release(): Promise<void>;
}
interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
}
interface VisibilityDocument {
  visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface WakeLock {
  /** Keep the screen on from now on (re-acquired whenever the page becomes visible again) */
  start(): void;
  /** Let the screen sleep again */
  stop(): void;
}

/**
 * A screen wake lock that survives the page being hidden: the browser drops the lock on every hide, so it is requested
 * again on each visibilitychange to visible while wanted. Without the API (or when a request fails, e.g. battery
 * saver) this does nothing.
 */
export function createWakeLock(
  nav: WakeLockNavigator | undefined = typeof navigator === 'undefined' ? undefined : (navigator as WakeLockNavigator),
  doc: VisibilityDocument | undefined = typeof document === 'undefined' ? undefined : document,
): WakeLock {
  let wanted = false;
  let sentinel: Sentinel | null = null;
  let requesting = false;

  async function acquire() {
    if (!wanted || requesting || !nav?.wakeLock || doc?.visibilityState !== 'visible') return;
    if (sentinel && !sentinel.released) return;
    requesting = true;
    try {
      const next = await nav.wakeLock.request('screen');
      if (wanted) sentinel = next;
      else void next.release().catch(() => {});
    } catch {
      // Refused (power saving, not visible any more): try again on the next visibilitychange
    } finally {
      requesting = false;
    }
  }

  const onVisibility = () => {
    if (doc?.visibilityState === 'visible') void acquire();
  };

  return {
    start() {
      if (wanted) return;
      wanted = true;
      doc?.addEventListener('visibilitychange', onVisibility);
      void acquire();
    },
    stop() {
      if (!wanted) return;
      wanted = false;
      doc?.removeEventListener('visibilitychange', onVisibility);
      const held = sentinel;
      sentinel = null;
      if (held && !held.released) void held.release().catch(() => {});
    },
  };
}
