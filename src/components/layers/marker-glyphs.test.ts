import { describe, expect, test } from 'bun:test';
import { GLYPHS } from './marker-glyphs';

describe('GLYPHS', () => {
  test('the lock for markers of areas we may not hunt is a path in the 24 x 24 box', () => {
    expect(GLYPHS.lock).toStartWith('M');
    const numbers = GLYPHS.lock.match(/-?\d*\.?\d+/g)!.map(Number);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(24);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(-24);
  });
});
