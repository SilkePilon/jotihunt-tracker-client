export interface IdleTracker {
  /** Activity (a mouse move): not idle now, idle again after the quiet period */
  poke(): void;
  dispose(): void;
}

interface Timers {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const WINDOW_TIMERS: Timers = {
  set: (callback, ms) => globalThis.setTimeout(callback, ms),
  clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * The video-player cursor: idle (cursor hidden) from the start and after `idleMs` without activity, shown again on the
 * next move. `onChange` only fires when the state flips, not on every mouse move.
 */
export function createIdleTracker(idleMs: number, onChange: (idle: boolean) => void, timers: Timers = WINDOW_TIMERS): IdleTracker {
  let idle = true;
  let timer: unknown;
  const settle = () => {
    timer = undefined;
    if (!idle) {
      idle = true;
      onChange(true);
    }
  };
  return {
    poke() {
      if (timer !== undefined) timers.clear(timer);
      timer = timers.set(settle, idleMs);
      if (idle) {
        idle = false;
        onChange(false);
      }
    },
    dispose() {
      if (timer !== undefined) timers.clear(timer);
      timer = undefined;
    },
  };
}
