import { describe, expect, test } from 'bun:test';
import { formatElapsed, reachChipText, reachFeatures, type AreaReach } from './reach';

const square = { type: 'Polygon' as const, coordinates: [[[5.8, 52], [5.81, 52], [5.81, 52.01], [5.8, 52]]] };
const at = Date.parse('2026-10-17T13:00:00+02:00');

function reach(overrides: Partial<AreaReach> = {}): AreaReach {
  return {
    area: 'alpha', fix: { id: 'm1', type: 'hint', at: new Date(at).toISOString(), lng: 5.8, lat: 52 },
    speedKmh: 4.6, measured: true, legs: 3, distanceM: 4000, capped: false, night: false, estimate: false,
    polygon: square, cone: null, ...overrides,
  };
}

describe('formatElapsed', () => {
  test('minutes, then hours with padded minutes', () => {
    expect(formatElapsed(0)).toBe('0 min');
    expect(formatElapsed(52 * 60_000 + 59_000)).toBe('52 min');
    expect(formatElapsed(65 * 60_000)).toBe('1u05m');
    expect(formatElapsed(-5000)).toBe('0 min');
  });
});

describe('reachChipText', () => {
  test('name, time since the fix and the measured speed', () => {
    expect(reachChipText(reach(), at + 52 * 60_000)).toBe('Alpha · 52 min · 4,6 km/u');
  });
  test('estimated speed gets ~, capped shows 3u+', () => {
    expect(reachChipText(reach({ speedKmh: 5, measured: false, capped: true }), at + 4 * 3600_000)).toBe('Alpha · 3u+ · ~5 km/u');
  });
});

describe('reachFeatures', () => {
  test('one area feature per fox plus its cone, coloured by area', () => {
    const collection = reachFeatures([reach(), reach({ area: 'bravo', cone: { teamApiId: 2, name: 'Open', bearing: 90, distanceM: 900, polygon: square } })], (area) => (area === 'alpha' ? '#f00' : '#0f0'));
    expect(collection.features.map((f) => [f.properties.area, f.properties.role, f.properties.color])).toEqual([
      ['alpha', 'area', '#f00'],
      ['bravo', 'area', '#0f0'],
      ['bravo', 'cone', '#0f0'],
    ]);
  });
});
