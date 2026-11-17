import { describe, expect, test } from 'bun:test';
import { HAPPY_HOUR_PILL_HEIGHT, HAPPY_HOUR_PILL_TOP, phoneToastOffset, phoneToastTop } from './toast-offset';

describe('phoneToastTop', () => {
  test('without the pill: just under the offline badge', () => {
    expect(phoneToastTop(false)).toBe(48);
  });

  test('with the pill: below its bottom edge, with a gap', () => {
    expect(phoneToastTop(true)).toBeGreaterThan(HAPPY_HOUR_PILL_TOP + HAPPY_HOUR_PILL_HEIGHT);
    expect(phoneToastTop(true)).toBe(80);
  });
});

describe('phoneToastOffset', () => {
  test('adds the top safe area', () => {
    expect(phoneToastOffset(true)).toEqual({ top: 'calc(env(safe-area-inset-top) + 80px)' });
    expect(phoneToastOffset(false)).toEqual({ top: 'calc(env(safe-area-inset-top) + 48px)' });
  });
});
