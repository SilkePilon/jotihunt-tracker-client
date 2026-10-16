import { useSyncExternalStore } from 'react';

/** Clock periods for labels that don't need to move every second ("x min geleden", ages). */
export const SLOW_CLOCK_TICK_MS = 15_000;
export const AGE_CLOCK_TICK_MS = 30_000;

interface Clock {
  subscribeTicking: (onChange: () => void) => () => void;
  subscribeStill: () => () => void;
  getNow: () => number;
}

/**
 * One shared clock per period for countdowns. Every (re)subscribe refreshes it, so a component that starts ticking
 * (e.g. a tegenhunt or happy hour just came in) renders with the current time instead of the time it last rendered with.
 */
function createClock(periodMs: number): Clock {
  let now = Date.now();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    subscribeTicking(onChange) {
      now = Date.now();
      listeners.add(onChange);
      timer ??= setInterval(() => {
        now = Date.now();
        for (const listener of listeners) listener();
      }, periodMs);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    subscribeStill() {
      now = Date.now();
      return () => {};
    },
    getNow: () => now,
  };
}

const clocks = new Map<number, Clock>();

function clockFor(periodMs: number): Clock {
  let clock = clocks.get(periodMs);
  if (!clock) {
    clock = createClock(periodMs);
    clocks.set(periodMs, clock);
  }
  return clock;
}

/** The current time (ms), updated every `periodMs` while `ticking`; React re-reads it after (re)subscribing. */
export function useNow(ticking: boolean, periodMs = 1000): number {
  const clock = clockFor(periodMs);
  return useSyncExternalStore(ticking ? clock.subscribeTicking : clock.subscribeStill, clock.getNow);
}
