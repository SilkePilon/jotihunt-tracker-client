import { useSyncExternalStore } from 'react';

/**
 * One shared clock for countdowns. Every (re)subscribe refreshes it, so a component that starts ticking (e.g. a
 * tegenhunt or happy hour just came in) renders with the current time instead of the time it last rendered with.
 */
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribeTicking(onChange: () => void) {
  now = Date.now();
  listeners.add(onChange);
  timer ??= setInterval(() => {
    now = Date.now();
    for (const listener of listeners) listener();
  }, 1000);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function subscribeStill() {
  now = Date.now();
  return () => {};
}

const getNow = () => now;

/** The current time (ms), updated every second while `ticking`; React re-reads it after (re)subscribing. */
export function useNow(ticking: boolean): number {
  return useSyncExternalStore(ticking ? subscribeTicking : subscribeStill, getNow);
}
