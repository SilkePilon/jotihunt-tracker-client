import { describe, expect, test } from 'bun:test';
import { createIdleTracker } from './idle';

function fakeTimers() {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    set: (callback: () => void) => {
      const id = next++;
      pending.set(id, callback);
      return id;
    },
    clear: (handle: unknown) => void pending.delete(handle as number),
    fire() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
    get size() {
      return pending.size;
    },
  };
}

describe('createIdleTracker', () => {
  test('a move shows the cursor, quiet hides it again', () => {
    const timers = fakeTimers();
    const changes: boolean[] = [];
    const tracker = createIdleTracker(3000, (idle) => changes.push(idle), timers);
    tracker.poke();
    expect(changes).toEqual([false]);
    timers.fire();
    expect(changes).toEqual([false, true]);
  });

  test('moves in a row restart the quiet period and report once', () => {
    const timers = fakeTimers();
    const changes: boolean[] = [];
    const tracker = createIdleTracker(3000, (idle) => changes.push(idle), timers);
    tracker.poke();
    tracker.poke();
    tracker.poke();
    expect(changes).toEqual([false]);
    expect(timers.size).toBe(1);
  });

  test('dispose cancels the pending timer', () => {
    const timers = fakeTimers();
    const changes: boolean[] = [];
    const tracker = createIdleTracker(3000, (idle) => changes.push(idle), timers);
    tracker.poke();
    tracker.dispose();
    expect(timers.size).toBe(0);
  });
});
