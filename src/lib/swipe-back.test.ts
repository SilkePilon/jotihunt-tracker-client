import { describe, expect, test } from 'bun:test';
import { swipeAxis, swipeGoesBack, swipeOffset } from './swipe-back';

describe('swipeAxis', () => {
  test('undecided until the finger moved a little', () => {
    expect(swipeAxis(4, 3)).toBe('pending');
  });

  test('clearly sideways is horizontal; a diagonal or vertical move is a scroll', () => {
    expect(swipeAxis(30, 5)).toBe('horizontal');
    expect(swipeAxis(-30, 5)).toBe('horizontal');
    expect(swipeAxis(20, 18)).toBe('vertical');
    expect(swipeAxis(2, 40)).toBe('vertical');
  });
});

describe('swipeOffset', () => {
  test('follows the finger rightwards only', () => {
    expect(swipeOffset(42)).toBe(42);
    expect(swipeOffset(-42)).toBe(0);
  });
});

describe('swipeGoesBack', () => {
  test('far enough goes back; the threshold is capped by the page width', () => {
    expect(swipeGoesBack(100, 0, 400)).toBe(true);
    expect(swipeGoesBack(80, 0, 400)).toBe(false);
    // Narrow page: 35% of 200 px = 70 px
    expect(swipeGoesBack(72, 0, 200)).toBe(true);
  });

  test('a quick flick goes back from a shorter drag, but not a jittery tap or a leftward flick', () => {
    expect(swipeGoesBack(40, 0.8, 400)).toBe(true);
    expect(swipeGoesBack(20, 2, 400)).toBe(false);
    expect(swipeGoesBack(40, -0.8, 400)).toBe(false);
  });
});
