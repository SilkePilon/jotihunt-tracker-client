import { describe, expect, test } from 'bun:test';
import { createFetchErrorToastState, ERROR_TOAST_COOLDOWN_MS, FAILING_KEY_STALE_MS } from './fetch-error-toast';

describe('fetch error toast', () => {
  test('one endpoint failing while others load: shown once, not cleared by other endpoints', () => {
    const state = createFetchErrorToastState();
    expect(state.error('/tracker/me', 0)).toBe(true);
    for (let t = 5_000; t < 10 * 60_000; t += 5_000) {
      expect(state.success('/markers', t)).toBe(false);
      expect(state.error('/tracker/me', t)).toBe(false);
    }
  });

  test('cleared only once every failing key loads again', () => {
    const state = createFetchErrorToastState();
    expect(state.error('/tracker/me', 0)).toBe(true);
    expect(state.error('/markers', 1)).toBe(false);
    expect(state.success('/markers', 2)).toBe(false);
    expect(state.success('/tracker/me', 3)).toBe(true);
    // Nothing to clear any more
    expect(state.success('/tracker/me', 4)).toBe(false);
  });

  test('a new outage after recovery shows again, but not within the cooldown', () => {
    const state = createFetchErrorToastState();
    expect(state.error('/hints/board', 0)).toBe(true);
    expect(state.success('/hints/board', 1_000)).toBe(true);
    // Flapping: a new failure within a minute stays quiet
    expect(state.error('/hints/board', 10_000)).toBe(false);
    expect(state.error('/hints/board', 20_000)).toBe(false);
    // The outage continues past the cooldown: shown once
    expect(state.error('/hints/board', ERROR_TOAST_COOLDOWN_MS)).toBe(true);
    expect(state.error('/hints/board', ERROR_TOAST_COOLDOWN_MS + 5_000)).toBe(false);
    expect(state.success('/hints/board', ERROR_TOAST_COOLDOWN_MS + 10_000)).toBe(true);
    expect(state.error('/hints/board', 3 * ERROR_TOAST_COOLDOWN_MS)).toBe(true);
  });

  test('a failing key that stops polling (unmounted) is forgotten after a while', () => {
    const state = createFetchErrorToastState();
    expect(state.error('/dialog-only', 0)).toBe(true);
    expect(state.success('/markers', FAILING_KEY_STALE_MS)).toBe(false);
    expect(state.success('/markers', FAILING_KEY_STALE_MS + 1)).toBe(true);
  });
});
