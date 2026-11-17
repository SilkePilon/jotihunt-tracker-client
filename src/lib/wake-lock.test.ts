import { describe, expect, test } from 'bun:test';
import { createWakeLock } from './wake-lock';

function fakes() {
  const listeners = new Set<() => void>();
  const sentinels: { released: boolean; release(): Promise<void> }[] = [];
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: 'visibilitychange', listener: () => void) => listeners.add(listener),
    removeEventListener: (_: 'visibilitychange', listener: () => void) => listeners.delete(listener),
  };
  const nav = {
    wakeLock: {
      request: async () => {
        const sentinel = {
          released: false,
          release: async () => {
            sentinel.released = true;
          },
        };
        sentinels.push(sentinel);
        return sentinel;
      },
    },
  };
  const setVisible = (visible: boolean) => {
    doc.visibilityState = visible ? 'visible' : 'hidden';
    listeners.forEach((listener) => listener());
  };
  return { doc, nav, sentinels, listeners, setVisible };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createWakeLock', () => {
  test('start requests a lock, stop releases it and stops listening', async () => {
    const { doc, nav, sentinels, listeners } = fakes();
    const lock = createWakeLock(nav, doc);
    lock.start();
    await tick();
    expect(sentinels).toHaveLength(1);
    expect(listeners.size).toBe(1);
    lock.stop();
    expect(sentinels[0].released).toBe(true);
    expect(listeners.size).toBe(0);
  });

  test('re-acquired when the page is shown again after the browser dropped it', async () => {
    const { doc, nav, sentinels, setVisible } = fakes();
    const lock = createWakeLock(nav, doc);
    lock.start();
    await tick();
    // The browser releases the lock on hide
    sentinels[0].released = true;
    setVisible(false);
    await tick();
    expect(sentinels).toHaveLength(1);
    setVisible(true);
    await tick();
    expect(sentinels).toHaveLength(2);
    expect(sentinels[1].released).toBe(false);
    lock.stop();
  });

  test('no second request while a lock is still held', async () => {
    const { doc, nav, sentinels, setVisible } = fakes();
    const lock = createWakeLock(nav, doc);
    lock.start();
    await tick();
    setVisible(true);
    await tick();
    expect(sentinels).toHaveLength(1);
    lock.stop();
  });

  test('a lock that arrives after stop is released straight away', async () => {
    const { doc, nav, sentinels } = fakes();
    const lock = createWakeLock(nav, doc);
    lock.start();
    lock.stop();
    await tick();
    expect(sentinels).toHaveLength(1);
    expect(sentinels[0].released).toBe(true);
  });

  test('does nothing without the API or while hidden', async () => {
    const { doc, sentinels, nav } = fakes();
    expect(() => createWakeLock({}, doc).start()).not.toThrow();
    doc.visibilityState = 'hidden';
    createWakeLock(nav, doc).start();
    await tick();
    expect(sentinels).toHaveLength(0);
  });
});
