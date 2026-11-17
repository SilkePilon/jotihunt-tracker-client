import { describe, expect, test } from 'bun:test';
import { createFetchErrorToastState, ERROR_TOAST_COOLDOWN_MS, ERROR_TOAST_DELAY_MS, FAILING_KEY_STALE_MS, fetchErrorToastText } from './fetch-error-toast';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

describe('fetch error toast', () => {
  test('one endpoint failing while others load: shown once (on its second failure), not cleared by other endpoints', () => {
    const state = createFetchErrorToastState();
    expect(state.error('/tracker/me', 0)).toBe(false);
    expect(state.error('/tracker/me', 5_000)).toBe(true);
    for (let t = 10_000; t < 10 * 60_000; t += 5_000) {
      expect(state.success('/markers', t)).toBe(false);
      expect(state.error('/tracker/me', t)).toBe(false);
    }
  });

  test('a single failure that recovers is a blip: no toast', () => {
    const state = createFetchErrorToastState();
    expect(state.error('/markers', 0)).toBe(false);
    expect(state.success('/markers', 4_000)).toBe(false);
    expect(state.error('/markers', 8_000)).toBe(false);
    expect(state.showing()).toBe(false);
  });

  test('one failure still unanswered after 15 s: due shows it once', () => {
    const state = createFetchErrorToastState();
    expect(state.error('/areas', 0)).toBe(false);
    expect(state.due(ERROR_TOAST_DELAY_MS - 1)).toBe(false);
    expect(state.due(ERROR_TOAST_DELAY_MS)).toBe(true);
    expect(state.due(ERROR_TOAST_DELAY_MS + 1)).toBe(false);
    // Answered in between: nothing is due
    const other = createFetchErrorToastState();
    other.error('/areas', 0);
    other.success('/areas', 3_000);
    expect(other.due(ERROR_TOAST_DELAY_MS)).toBe(false);
  });

  test('quiet failures (phone, network) never show the toast but still count as failing', () => {
    const state = createFetchErrorToastState();
    for (let t = 0; t < 60_000; t += 5_000) expect(state.error('/markers', t, { quiet: true })).toBe(false);
    expect(state.due(60_000)).toBe(false);
    expect(state.failingKeys(60_000)).toEqual(['/markers']);
    // A loud failure (a server error) during the same outage counts on its own
    expect(state.error('/areas', 61_000)).toBe(false);
    expect(state.error('/areas', 62_000)).toBe(true);
    expect(state.success('/areas', 63_000)).toBe(false);
    expect(state.success('/markers', 64_000)).toBe(true);
  });

  test('failingKeys lists only the keys failing now (what Opnieuw refetches)', () => {
    const state = createFetchErrorToastState();
    expect(state.failingKeys(0)).toEqual([]);
    expect(state.showing()).toBe(false);
    state.error('/tracker/me', 0);
    state.error('/tracker/me', 1);
    state.error('/markers', 1);
    expect(state.showing()).toBe(true);
    state.success('/markers', 2);
    expect(state.failingKeys(3)).toEqual(['/tracker/me']);
    // A key that stopped failing long ago (unmounted) is not refetched
    expect(state.failingKeys(FAILING_KEY_STALE_MS + 2)).toEqual([]);
  });

  test('cleared only once every failing key loads again', () => {
    const state = createFetchErrorToastState();
    expect(state.error('/tracker/me', 0)).toBe(false);
    expect(state.error('/tracker/me', 1)).toBe(true);
    expect(state.error('/markers', 1)).toBe(false);
    expect(state.success('/markers', 2)).toBe(false);
    expect(state.success('/tracker/me', 3)).toBe(true);
    // Nothing to clear any more
    expect(state.success('/tracker/me', 4)).toBe(false);
  });

  test('a new outage after recovery shows again, but not within the cooldown', () => {
    const state = createFetchErrorToastState();
    state.error('/hints/board', 0);
    expect(state.error('/hints/board', 1)).toBe(true);
    expect(state.success('/hints/board', 1_000)).toBe(true);
    // Flapping: new failures within a minute stay quiet
    expect(state.error('/hints/board', 10_000)).toBe(false);
    expect(state.error('/hints/board', 20_000)).toBe(false);
    // The outage continues past the cooldown: shown once
    expect(state.error('/hints/board', ERROR_TOAST_COOLDOWN_MS + 1)).toBe(true);
    expect(state.error('/hints/board', ERROR_TOAST_COOLDOWN_MS + 5_000)).toBe(false);
    expect(state.success('/hints/board', ERROR_TOAST_COOLDOWN_MS + 10_000)).toBe(true);
    state.error('/hints/board', 3 * ERROR_TOAST_COOLDOWN_MS);
    expect(state.error('/hints/board', 3 * ERROR_TOAST_COOLDOWN_MS + 1)).toBe(true);
  });

  test('a failing key that stops polling (unmounted) is forgotten after a while', () => {
    const state = createFetchErrorToastState();
    state.error('/dialog-only', 0);
    expect(state.error('/dialog-only', 1)).toBe(true);
    expect(state.success('/markers', FAILING_KEY_STALE_MS + 1)).toBe(false);
    expect(state.success('/markers', FAILING_KEY_STALE_MS + 2)).toBe(true);
  });
});

describe('fetchErrorToastText', () => {
  test('no answer: about the connection; an answer: about the server; never the raw message', () => {
    expect(fetchErrorToastText(new AxiosError('Network Error', 'ERR_NETWORK')).title).toBe('Geen verbinding met de server');
    const response = { data: {}, status: 500, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } } as AxiosResponse;
    const serverError = fetchErrorToastText(new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', undefined, undefined, response));
    expect(serverError.title).toBe('Gegevens laden mislukt');
    expect(serverError.description).not.toContain('status code');
  });
});
