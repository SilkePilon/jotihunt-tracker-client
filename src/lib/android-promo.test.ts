// src/lib/android-promo.test.ts
import { describe, expect, test } from 'bun:test';
import { appDidNotOpen, isAndroidUserAgent, laterState, LATER_MS, readPromoState, shouldShowAndroidPromo, writePromoState } from './android-promo';

const base = { isMobile: true, isAndroid: true, hasRelease: true, paired: false, installed: false, state: {}, now: 1_000_000 };

describe('isAndroidUserAgent', () => {
  test('Android Chrome', () => expect(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36')).toBe(true));
  test('iPhone', () => expect(isAndroidUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1')).toBe(false));
  test('desktop', () => expect(isAndroidUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/141')).toBe(false));
});

describe('shouldShowAndroidPromo', () => {
  test('all conditions met', () => expect(shouldShowAndroidPromo(base)).toBe(true));
  test.each([
    ['not mobile', { isMobile: false }],
    ['not Android', { isAndroid: false }],
    ['no APK on the server', { hasRelease: false }],
    ['already paired', { paired: true }],
    ['app detected as installed', { installed: true }],
    ['never again', { state: { never: true as const } }],
  ])('hidden when %s', (_, patch) => expect(shouldShowAndroidPromo({ ...base, ...patch })).toBe(false));
  test('never wins over everything', () => expect(shouldShowAndroidPromo({ ...base, state: { never: true, hiddenUntil: base.now - 1 } })).toBe(false));
  test('"Later" hides for 3 days', () => {
    const state = laterState(base.now);
    expect(shouldShowAndroidPromo({ ...base, state, now: base.now + LATER_MS - 1 })).toBe(false);
    expect(shouldShowAndroidPromo({ ...base, state, now: base.now + LATER_MS })).toBe(true);
  });
});

describe('storage', () => {
  test('round trip', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    writePromoState(storage, { never: true });
    expect(readPromoState(storage)).toEqual({ never: true });
  });
  test('missing or corrupt → empty state', () => {
    expect(readPromoState({ getItem: () => null })).toEqual({});
    expect(readPromoState({ getItem: () => '{oops' })).toEqual({});
    expect(readPromoState({ getItem: () => '"text"' })).toEqual({});
  });
  test('non-finite hiddenUntil is dropped', () => {
    // JSON can't hold Infinity/NaN, but 1e999 parses to Infinity
    expect(readPromoState({ getItem: () => '{"hiddenUntil":1e999}' })).toEqual({});
    expect(readPromoState({ getItem: () => '{"hiddenUntil":-1e999,"never":true}' })).toEqual({ never: true });
  });
});

describe('appDidNotOpen', () => {
  test('page still visible after 2.5 s → the app did not open', () => expect(appDidNotOpen(0, 2500, true)).toBe(true));
  test('too early', () => expect(appDidNotOpen(0, 2000, true)).toBe(false));
  test('page hidden (the app took over)', () => expect(appDidNotOpen(0, 9000, false)).toBe(false));
});
