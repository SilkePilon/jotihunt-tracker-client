import { describe, expect, test } from 'bun:test';
import { landingSpot, shouldFlashbang, throwPath } from './flashbang';

describe('flashbang theme switch', () => {
  test('only dark → light throws a flashbang', () => {
    expect(shouldFlashbang({ isDarkMode: true, reducedMotion: false })).toBe(true);
    expect(shouldFlashbang({ isDarkMode: false, reducedMotion: false })).toBe(false);
  });

  test('reduced motion keeps the plain switch', () => {
    expect(shouldFlashbang({ isDarkMode: true, reducedMotion: true })).toBe(false);
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
});
