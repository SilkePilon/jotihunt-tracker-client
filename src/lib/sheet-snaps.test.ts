import { describe, expect, test } from 'bun:test';
import { computeSnapHeights, nextSnap, rubberBand, settleSnap } from './sheet-snaps';

describe('computeSnapHeights', () => {
  test('iPhone-like viewport', () => {
    expect(computeSnapHeights({ visibleH: 760, safeTop: 47, safeBottom: 34, peekContent: 136 })).toEqual({ peek: 170, half: 380, full: 701 });
  });
  test('peek content is clamped to 120 … 22% of the visible height', () => {
    expect(computeSnapHeights({ visibleH: 800, safeTop: 0, safeBottom: 0, peekContent: 60 }).peek).toBe(120);
    expect(computeSnapHeights({ visibleH: 800, safeTop: 0, safeBottom: 0, peekContent: 400 }).peek).toBe(176);
  });
  test('landscape: half never below peek, nothing above full', () => {
    const h = computeSnapHeights({ visibleH: 360, safeTop: 0, safeBottom: 21, peekContent: 136 });
    expect(h.half).toBeGreaterThanOrEqual(h.peek);
    expect(h.peek).toBeLessThanOrEqual(h.full);
    expect(h.half).toBeLessThanOrEqual(h.full);
  });
});

describe('rubberBand', () => {
  test('inside the range is unchanged', () => expect(rubberBand(300, 100, 700)).toBe(300));
  test('above max moves at a quarter', () => expect(rubberBand(800, 100, 700)).toBe(725));
  test('below min moves at 40%', () => expect(rubberBand(50, 100, 700)).toBe(80));
});

describe('settleSnap', () => {
  const heights = { peek: 170, half: 380, full: 700 };
  test('slow release picks the nearest snap', () => {
    expect(settleSnap(300, 0, heights)).toBe('half');
    expect(settleSnap(600, 0.1, heights)).toBe('full');
    expect(settleSnap(200, -0.1, heights)).toBe('peek');
  });
  test('an upward flick goes to the next snap above', () => {
    expect(settleSnap(200, 0.8, heights)).toBe('half');
    expect(settleSnap(390, 0.8, heights)).toBe('full');
  });
  test('a downward flick goes to the next snap below', () => {
    expect(settleSnap(650, -0.8, heights)).toBe('half');
    expect(settleSnap(370, -0.8, heights)).toBe('peek');
  });
  test('a flick past the ends stays at the end', () => {
    expect(settleSnap(720, 0.9, heights)).toBe('full');
    expect(settleSnap(150, -0.9, heights)).toBe('peek');
  });
});

test('nextSnap cycles peek → half → full → peek', () => {
  expect(nextSnap('peek')).toBe('half');
  expect(nextSnap('half')).toBe('full');
  expect(nextSnap('full')).toBe('peek');
});
