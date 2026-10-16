import { describe, expect, test } from 'bun:test';
import { extendRinging, landingSpot, shouldFlashbang, throwPath } from './flashbang';

describe('flashbang theme switch', () => {
  test('only dark → light throws a flashbang', () => {
    expect(shouldFlashbang({ isDarkMode: true, reducedMotion: false, touchDevice: false })).toBe(true);
    expect(shouldFlashbang({ isDarkMode: false, reducedMotion: false, touchDevice: false })).toBe(false);
  });

  test('reduced motion keeps the plain switch', () => {
    expect(shouldFlashbang({ isDarkMode: true, reducedMotion: true, touchDevice: false })).toBe(false);
  });

  test('mobile devices keep the plain switch', () => {
    expect(shouldFlashbang({ isDarkMode: true, reducedMotion: false, touchDevice: true })).toBe(false);
  });

  test('throw starts at the toggle and comes to rest past the landing spot', () => {
    const path = throwPath({ x: 40, y: 30 }, { x: 640, y: 500 });
    expect(path.x[0]).toBe(40);
    expect(path.y[0]).toBe(30);
    expect(path.x[2]).toBe(640);
    expect(path.y[2]).toBe(500);
    expect(path.end.x).toBeGreaterThan(640);
    expect(path.end).toEqual({ x: path.x.at(-1)!, y: path.y.at(-1)! });
  });

  test('every track has a keyframe per time, times run 0 → 1', () => {
    const path = throwPath({ x: 900, y: 400 }, { x: 300, y: 500 });
    for (const track of [path.x, path.y, path.rotate]) expect(track).toHaveLength(path.times.length);
    expect(path.times[0]).toBe(0);
    expect(path.times.at(-1)).toBe(1);
    // thrown leftwards, it rolls on leftwards
    expect(path.end.x).toBeLessThan(300);
  });

  test('the arc peaks above both ends but stays on screen', () => {
    const low = throwPath({ x: 0, y: 600 }, { x: 500, y: 500 });
    expect(low.y[1]).toBeLessThan(500);
    const high = throwPath({ x: 0, y: 20 }, { x: 500, y: 500 });
    expect(high.y[1]).toBe(24);
  });

  test('landing spot stays around the middle', () => {
    const middle = landingSpot(1000, 800, () => 0.5);
    expect(middle.x).toBeCloseTo(500);
    expect(middle.y).toBeCloseTo(440);
    const corner = landingSpot(1000, 800, () => 0);
    expect(corner.x).toBeCloseTo(420);
    expect(corner.y).toBeCloseTo(392);
  });

  describe('extending the ringing', () => {
    const source = Float32Array.from({ length: 100 }, (_, i) => i);

    test('keeps the recording up to the loop end, then repeats the loop', () => {
      const out = extendRinging(source, 60, { from: 20, to: 40, crossfade: 0 });
      expect(Array.from(out.subarray(0, 40))).toEqual(Array.from(source.subarray(0, 40)));
      expect(Array.from(out.subarray(40, 60))).toEqual(Array.from(source.subarray(20, 40)));
    });

    test('fills the whole length, without silent gaps', () => {
      const out = extendRinging(Float32Array.from({ length: 50 }, () => 1), 400, { from: 10, to: 40, crossfade: 8 });
      expect(out).toHaveLength(400);
      expect(Math.min(...out)).toBeGreaterThan(0.99);
    });

    test('seams cross-fade with equal power: constant ringing stays at the same loudness', () => {
      const out = extendRinging(Float32Array.from({ length: 50 }, () => 0.5), 200, { from: 10, to: 40, crossfade: 10 });
      // cos + sin peaks at √2 halfway the seam: equal power for uncorrelated noise like the ringing
      expect(Math.max(...out)).toBeLessThanOrEqual(0.5 * Math.SQRT2 + 1e-6);
      expect(Math.min(...out)).toBeGreaterThanOrEqual(0.5 - 1e-6);
    });

    test('shorter than the recording just cuts it', () => {
      const out = extendRinging(source, 30, { from: 20, to: 40, crossfade: 5 });
      expect(Array.from(out)).toEqual(Array.from(source.subarray(0, 30)));
    });
  });
});
