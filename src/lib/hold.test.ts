import { describe, expect, test } from 'bun:test';
import { holdProgressAfter, isHoldComplete } from './hold';

describe('hold to confirm', () => {
  test('progress is the elapsed share of the duration', () => {
    expect(holdProgressAfter(0, 1000)).toBe(0);
    expect(holdProgressAfter(250, 1000)).toBe(0.25);
    expect(holdProgressAfter(1000, 1000)).toBe(1);
  });

  test('progress clamps to 0..1', () => {
    expect(holdProgressAfter(1500, 1000)).toBe(1);
    expect(holdProgressAfter(-50, 1000)).toBe(0);
  });

  test('zero or negative duration counts as instantly done', () => {
    expect(holdProgressAfter(0, 0)).toBe(1);
    expect(holdProgressAfter(10, -5)).toBe(1);
    expect(isHoldComplete(0, 0)).toBe(true);
  });

  test('complete at exactly the duration, not a millisecond before', () => {
    expect(isHoldComplete(999, 1000)).toBe(false);
    expect(isHoldComplete(1000, 1000)).toBe(true);
    expect(isHoldComplete(1200, 1000)).toBe(true);
  });

  test('negative or non-finite elapsed time is never complete', () => {
    expect(isHoldComplete(-1, 1000)).toBe(false);
    expect(isHoldComplete(Number.NaN, 1000)).toBe(false);
    expect(holdProgressAfter(Number.NaN, 1000)).toBe(0);
  });
});
