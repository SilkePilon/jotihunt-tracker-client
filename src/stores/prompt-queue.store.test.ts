import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import usePromptQueueStore, { AFTER_TOUR_QUIET_MS, nextPromptStep, PROMPT_GAP_MS, type PromptQueueTimes } from './prompt-queue.store';

const T = 1_000_000;
const idle: PromptQueueTimes = { waiting: {}, active: null, held: false, readyAt: 0, tourEndedAt: null, mapTouchedAt: null };
const queue = () => usePromptQueueStore.getState();

describe('nextPromptStep', () => {
  test('nothing waiting: idle', () => {
    expect(nextPromptStep(idle, T)).toBeNull();
  });

  test('a request shows after the gap', () => {
    const times = { ...idle, waiting: { passkey: T } };
    expect(nextPromptStep(times, T)).toEqual({ waitMs: PROMPT_GAP_MS });
    expect(nextPromptStep(times, T + PROMPT_GAP_MS)).toEqual({ show: 'passkey' });
  });

  test('held (tour) or another prompt on screen: nothing shows', () => {
    const waiting = { notifications: T - 10_000 };
    expect(nextPromptStep({ ...idle, waiting, held: true }, T)).toBeNull();
    expect(nextPromptStep({ ...idle, waiting, active: 'passkey' }, T)).toBeNull();
  });

  test('a fixed order: notifications, then the Android promo, then the passkey', () => {
    const waiting = { passkey: T - 9000, 'android-promo': T - 8000, notifications: T - 5000 };
    expect(nextPromptStep({ ...idle, waiting }, T)).toEqual({ show: 'notifications' });
    expect(nextPromptStep({ ...idle, waiting: { passkey: T - 9000, 'android-promo': T - 8000 } }, T)).toEqual({ show: 'android-promo' });
  });

  test('after the tour, map use holds prompts back for the first seconds', () => {
    const base = { ...idle, waiting: { notifications: T - 60_000 }, tourEndedAt: T, readyAt: T + PROMPT_GAP_MS };
    // Not using the map: just the gap
    expect(nextPromptStep(base, T + PROMPT_GAP_MS)).toEqual({ show: 'notifications' });
    // Panning the map after the tour: wait until the quiet period is over
    const busy = { ...base, mapTouchedAt: T + 1000 };
    expect(nextPromptStep(busy, T + PROMPT_GAP_MS)).toEqual({ waitMs: AFTER_TOUR_QUIET_MS - PROMPT_GAP_MS });
    expect(nextPromptStep(busy, T + AFTER_TOUR_QUIET_MS)).toEqual({ show: 'notifications' });
    // Map use from before the tour ended doesn't count
    expect(nextPromptStep({ ...base, mapTouchedAt: T - 1 }, T + PROMPT_GAP_MS)).toEqual({ show: 'notifications' });
  });
});

describe('prompt queue store', () => {
  beforeEach(() => queue().reset());
  afterEach(() => queue().reset());

  test('one at a time; the next only a gap after the previous closed', () => {
    queue().request('passkey', T);
    queue().request('notifications', T);
    queue().pump(T + PROMPT_GAP_MS);
    expect(queue().active).toBe('notifications');
    queue().pump(T + 60_000);
    expect(queue().active).toBe('notifications');
    queue().done('notifications', T + 60_000);
    expect(queue().active).toBeNull();
    queue().pump(T + 60_000 + PROMPT_GAP_MS - 1);
    expect(queue().active).toBeNull();
    queue().pump(T + 60_000 + PROMPT_GAP_MS);
    expect(queue().active).toBe('passkey');
  });

  test('requests while held wait for the tour to end, then the gap', () => {
    queue().setHeld(true, T);
    queue().request('android-promo', T);
    queue().pump(T + 30_000);
    expect(queue().active).toBeNull();
    queue().setHeld(false, T + 30_000);
    expect(queue().tourEndedAt).toBe(T + 30_000);
    queue().pump(T + 30_000 + PROMPT_GAP_MS);
    expect(queue().active).toBe('android-promo');
  });

  test('map use right after the tour pushes the prompt to the end of the quiet period', () => {
    queue().setHeld(true, T);
    queue().request('notifications', T);
    queue().setHeld(false, T + 1000);
    queue().mapTouched(T + 2000);
    queue().pump(T + 1000 + PROMPT_GAP_MS);
    expect(queue().active).toBeNull();
    queue().pump(T + 1000 + AFTER_TOUR_QUIET_MS);
    expect(queue().active).toBe('notifications');
  });

  test('cancel leaves the queue; done for a prompt not on screen is ignored; duplicate requests keep their place', () => {
    queue().request('passkey', T);
    queue().request('passkey', T + 5000);
    expect(queue().waiting.passkey).toBe(T);
    queue().cancel('passkey');
    queue().pump(T + 10_000);
    expect(queue().active).toBeNull();
    queue().request('notifications', T);
    queue().pump(T + PROMPT_GAP_MS);
    queue().done('passkey', T + PROMPT_GAP_MS);
    expect(queue().active).toBe('notifications');
    // A prompt on screen stays when it is no longer due; only done frees the turn
    queue().cancel('notifications');
    expect(queue().active).toBe('notifications');
  });
});
