import { afterEach, describe, expect, test } from 'bun:test';
import useFollowMeStore, { FOLLOW_IDLE_MS, followIdle } from './follow-me.store';

describe('follow me', () => {
  afterEach(() => useFollowMeStore.setState({ following: false, startedAt: null, located: null }));

  test('start remembers when, stop forgets it', () => {
    useFollowMeStore.getState().start(1000);
    expect(useFollowMeStore.getState()).toMatchObject({ following: true, startedAt: 1000 });
    useFollowMeStore.getState().stop();
    expect(useFollowMeStore.getState()).toMatchObject({ following: false, startedAt: null });
  });

  test('runs idle 10 minutes after the start or the last interaction', () => {
    expect(followIdle(null, null, 10 * FOLLOW_IDLE_MS)).toBe(false);
    expect(followIdle(0, null, FOLLOW_IDLE_MS - 1)).toBe(false);
    expect(followIdle(0, null, FOLLOW_IDLE_MS)).toBe(true);
    // An interaction since the start restarts the window
    expect(followIdle(0, 60_000, FOLLOW_IDLE_MS)).toBe(false);
    expect(followIdle(0, 60_000, FOLLOW_IDLE_MS + 60_000)).toBe(true);
    // One from before this start doesn't count
    expect(followIdle(120_000, 60_000, FOLLOW_IDLE_MS + 60_000)).toBe(false);
  });
});
