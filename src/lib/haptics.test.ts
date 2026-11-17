import { describe, expect, test } from 'bun:test';
import { CONFIRM_HAPTIC_MS, confirmHaptic } from './haptics';

describe('confirmHaptic', () => {
  test('a short vibration where the browser has one', () => {
    const calls: number[] = [];
    confirmHaptic({ vibrate: (ms) => (calls.push(ms), true) });
    expect(calls).toEqual([CONFIRM_HAPTIC_MS]);
    expect(CONFIRM_HAPTIC_MS).toBe(10);
  });

  test('nothing (and no error) without vibrate, without a navigator, or when it throws', () => {
    expect(() => confirmHaptic({})).not.toThrow();
    expect(() => confirmHaptic(undefined)).not.toThrow();
    expect(() =>
      confirmHaptic({
        vibrate: () => {
          throw new Error('blocked');
        },
      }),
    ).not.toThrow();
  });
});
