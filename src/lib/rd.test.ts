import { describe, expect, test } from 'bun:test';
import proj4 from 'proj4';
import { fromRD, isPlausibleRD, toRD } from './rd';

describe('RD conversion', () => {
  test('Amersfoort (the RD origin) round trips', () => {
    const [lng, lat] = fromRD(155000, 463000);
    expect(lng).toBeCloseTo(5.3872, 4);
    expect(lat).toBeCloseTo(52.1552, 4);
    const back = toRD(lng, lat);
    expect(back.x).toBeCloseTo(155000, 2);
    expect(back.y).toBeCloseTo(463000, 2);
  });

  test('registers the global RD projection for direct proj4 calls', () => {
    const [x, y] = proj4('WGS84', 'RD', [5.3872, 52.1552]);
    expect(Math.round(x / 100)).toBe(1550);
    expect(Math.round(y / 100)).toBe(4630);
  });

  test('isPlausibleRD', () => {
    expect(isPlausibleRD(155000, 463000)).toBe(true);
    expect(isPlausibleRD(0, 290000)).toBe(true);
    expect(isPlausibleRD(290000, 630000)).toBe(true);
    expect(isPlausibleRD(-1, 463000)).toBe(false);
    expect(isPlausibleRD(155000, 289999)).toBe(false);
    expect(isPlausibleRD(155000, 630001)).toBe(false);
    expect(isPlausibleRD(Number.NaN, 463000)).toBe(false);
  });
});
