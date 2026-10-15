import { describe, expect, test } from 'bun:test';
import {
  coastDistance,
  isOrbitStart,
  lockAxis,
  ORBIT_COAST_MS,
  ORBIT_MAX_PITCH,
  orbitStep,
  recentSpeed,
  snapBearing,
} from './orbit';

describe('isOrbitStart', () => {
  test('right and middle buttons start an orbit', () => {
    expect(isOrbitStart(2, false)).toBe(true);
    expect(isOrbitStart(1, false)).toBe(true);
  });
  test('left button only with Ctrl', () => {
    expect(isOrbitStart(0, false)).toBe(false);
    expect(isOrbitStart(0, true)).toBe(true);
  });
  test('other buttons never', () => {
    expect(isOrbitStart(3, true)).toBe(false);
  });
});

describe('lockAxis', () => {
  test('undecided under 6 px', () => {
    expect(lockAxis(3, 4)).toBeNull();
    expect(lockAxis(0, 0)).toBeNull();
  });
  test('mostly horizontal rotates, mostly vertical pitches', () => {
    expect(lockAxis(6, 2)).toBe('rotate');
    expect(lockAxis(-7, 1)).toBe('rotate');
    expect(lockAxis(1, -6)).toBe('pitch');
    expect(lockAxis(2, 9)).toBe('pitch');
  });
  test('an exact diagonal rotates', () => {
    expect(lockAxis(5, 5)).toBe('rotate');
  });
});

describe('orbitStep', () => {
  test('rotate: 0.3 degrees per pixel, pitch untouched', () => {
    expect(orbitStep('rotate', 100, 40, 10, 30)).toEqual({ bearing: 40, pitch: 30 });
    expect(orbitStep('rotate', -100, 0, 10, 30)).toEqual({ bearing: -20, pitch: 30 });
  });
  test('pitch: dragging up tilts more, 0.25 degrees per pixel, bearing untouched', () => {
    expect(orbitStep('pitch', 50, -40, 10, 30)).toEqual({ bearing: 10, pitch: 40 });
    expect(orbitStep('pitch', 0, 40, 10, 30)).toEqual({ bearing: 10, pitch: 20 });
  });
  test('pitch is clamped to 0..60', () => {
    expect(orbitStep('pitch', 0, -1000, 0, 30).pitch).toBe(ORBIT_MAX_PITCH);
    expect(orbitStep('pitch', 0, 1000, 0, 30).pitch).toBe(0);
  });
});

describe('coastDistance', () => {
  test('no coast at or below the minimum speed', () => {
    expect(coastDistance(0)).toBe(0);
    expect(coastDistance(0.05)).toBe(0);
    expect(coastDistance(-0.04)).toBe(0);
  });
  test('speed x 300 ms / 2, keeping the sign', () => {
    expect(coastDistance(0.2)).toBeCloseTo((0.2 * ORBIT_COAST_MS) / 2);
    expect(coastDistance(-0.2)).toBeCloseTo((-0.2 * ORBIT_COAST_MS) / 2);
  });
});

describe('snapBearing', () => {
  test('within 7 degrees of north snaps to 0', () => {
    expect(snapBearing(6.9)).toBe(0);
    expect(snapBearing(-7)).toBe(0);
    expect(snapBearing(355)).toBe(0);
    expect(snapBearing(-358)).toBe(0);
  });
  test('further away keeps the bearing, normalised to -180..180', () => {
    expect(snapBearing(7.5)).toBe(7.5);
    expect(snapBearing(-30)).toBe(-30);
    expect(snapBearing(350)).toBe(-10);
    expect(snapBearing(190)).toBe(-170);
  });
});

describe('recentSpeed', () => {
  test('degrees per ms over the last 80 ms', () => {
    const samples = [
      { t: 0, bearing: 0 },
      { t: 100, bearing: 10 },
      { t: 150, bearing: 20 },
      { t: 180, bearing: 26 },
    ];
    // window starts at 100: (26 - 10) / (180 - 100)
    expect(recentSpeed(samples, 180)).toBeCloseTo(0.2);
  });
  test('0 with fewer than two recent samples', () => {
    expect(recentSpeed([], 100)).toBe(0);
    expect(recentSpeed([{ t: 0, bearing: 0 }, { t: 10, bearing: 5 }], 500)).toBe(0);
    expect(recentSpeed([{ t: 490, bearing: 5 }], 500)).toBe(0);
  });
});
