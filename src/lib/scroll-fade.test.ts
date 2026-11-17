import { describe, expect, test } from 'bun:test';
import { hasMoreBelow } from './scroll-fade';

describe('hasMoreBelow', () => {
  test('content that fits: no fade', () => {
    expect(hasMoreBelow({ scrollTop: 0, scrollHeight: 400, clientHeight: 400 })).toBe(false);
  });

  test('more content below: fade, until scrolled to the end', () => {
    expect(hasMoreBelow({ scrollTop: 0, scrollHeight: 900, clientHeight: 400 })).toBe(true);
    expect(hasMoreBelow({ scrollTop: 499, scrollHeight: 900, clientHeight: 400 })).toBe(false);
    expect(hasMoreBelow({ scrollTop: 499.5, scrollHeight: 900, clientHeight: 400 })).toBe(false);
    expect(hasMoreBelow({ scrollTop: 450, scrollHeight: 900, clientHeight: 400 })).toBe(true);
  });
});
