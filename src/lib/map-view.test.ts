import { describe, expect, test } from 'bun:test';
import { isRotated } from './map-view';

describe('isRotated', () => {
  test('north-up and flat (with float noise) is not rotated', () => {
    expect(isRotated(0, 0)).toBe(false);
    expect(isRotated(0.6, 0.2)).toBe(false);
    expect(isRotated(-0.9, 0)).toBe(false);
  });

  test('a twist past 1° either way, or any tilt, is', () => {
    expect(isRotated(12, 0)).toBe(true);
    expect(isRotated(-1.5, 0)).toBe(true);
    expect(isRotated(0, 50)).toBe(true);
  });
});
