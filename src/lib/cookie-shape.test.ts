import { describe, expect, test } from 'bun:test';
import { BADGE_COOKIE_DEPTH, COOKIE_LOBES, cookiePath, cookiePoints, cookieRadius, MARKER_COOKIE_DEPTH } from './cookie-shape';

describe('cookie shape', () => {
  test('points stay between the inner and outer radius', () => {
    for (const depth of [MARKER_COOKIE_DEPTH, BADGE_COOKIE_DEPTH]) {
      for (const [x, y] of cookiePoints(50, 50, 40, depth)) {
        const r = Math.hypot(x - 50, y - 50);
        expect(r).toBeLessThanOrEqual(40 + 1e-9);
        expect(r).toBeGreaterThanOrEqual(40 * (1 - depth) - 1e-9);
      }
    }
  });

  test('nine lobes per turn', () => {
    const steps = 720;
    const radii = Array.from({ length: steps }, (_, i) => cookieRadius(1, (2 * Math.PI * i) / steps, BADGE_COOKIE_DEPTH));
    const peaks = radii.filter((r, i) => r > radii[(i + steps - 1) % steps] && r >= radii[(i + 1) % steps]);
    expect(peaks).toHaveLength(COOKIE_LOBES);
  });

  test('SVG path is closed and fits the box', () => {
    const path = cookiePath(72, BADGE_COOKIE_DEPTH);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(72);
  });
});
