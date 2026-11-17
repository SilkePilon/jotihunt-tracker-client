import { describe, expect, test } from 'bun:test';
import { spacedHitDiameters } from './hit-spacing';

describe('spacedHitDiameters', () => {
  test('a lone dot gets the full size', () => {
    expect(spacedHitDiameters([{ x: 0, y: 0 }], 44)).toEqual([44]);
  });

  test('far apart dots get the full size', () => {
    expect(spacedHitDiameters([{ x: 0, y: 0 }, { x: 100, y: 0 }], 44)).toEqual([44, 44]);
  });

  test('close dots shrink to the gap to their nearest neighbour, so the circles only touch', () => {
    const sizes = spacedHitDiameters([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 90, y: 0 }], 44);
    expect(sizes).toEqual([30, 30, 44]);
    // radii of neighbours never add up to more than their distance
    expect(sizes[0] / 2 + sizes[1] / 2).toBeLessThanOrEqual(30);
    expect(sizes[1] / 2 + sizes[2] / 2).toBeLessThanOrEqual(60);
  });

  test('uses the euclidean distance', () => {
    expect(spacedHitDiameters([{ x: 0, y: 0 }, { x: 12, y: 16 }], 44)).toEqual([20, 20]);
  });

  test('no points, no sizes', () => {
    expect(spacedHitDiameters([], 44)).toEqual([]);
  });
});
