import { describe, expect, test } from 'bun:test';
import proj4 from 'proj4';
import { fromRD, isPlausibleRD, RD_BOUNDS, toRD } from './rd';

// The definition rd.ts used to register with proj4; the closed-form port must agree with it
proj4.defs(
  'RD',
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs',
);

/** Distance in metres between two WGS84 points (equirectangular; exact enough at these tiny separations) */
function metres([lng1, lat1]: number[], [lng2, lat2]: number[]): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dx = (lng2 - lng1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad) * R;
  const dy = (lat2 - lat1) * toRad * R;
  return Math.hypot(dx, dy);
}

describe('RD conversion', () => {
  test('Amersfoort (the RD origin) round trips', () => {
    const [lng, lat] = fromRD(155000, 463000);
    expect(lng).toBeCloseTo(5.3872, 4);
    expect(lat).toBeCloseTo(52.1552, 4);
    const back = toRD(lng, lat);
    expect(back.x).toBeCloseTo(155000, 2);
    expect(back.y).toBeCloseTo(463000, 2);
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

  test('fromRD agrees with proj4 over a 2 km grid covering the RD bounds', () => {
    let worst = 0;
    for (let x = RD_BOUNDS.minX; x <= RD_BOUNDS.maxX; x += 2_000) {
      for (let y = RD_BOUNDS.minY; y <= RD_BOUNDS.maxY; y += 2_000) {
        worst = Math.max(worst, metres(fromRD(x, y), proj4('RD', 'WGS84', [x, y])));
      }
    }
    expect(worst).toBeLessThan(0.001);
  });

  test('toRD agrees with proj4 over a 0.02° grid covering the Netherlands', () => {
    let worst = 0;
    for (let lng = 3.2; lng <= 7.3; lng += 0.02) {
      for (let lat = 50.7; lat <= 53.6; lat += 0.02) {
        const { x, y } = toRD(lng, lat);
        const [px, py] = proj4('WGS84', 'RD', [lng, lat]);
        worst = Math.max(worst, Math.hypot(x - px, y - py));
      }
    }
    expect(worst).toBeLessThan(0.001);
  });

  test('known points', () => {
    // Onze Lieve Vrouwetoren, Amersfoort (the RD origin): RDNAPTRANS gives 5.38720621, 52.15517440; the 7-parameter
    // towgs84 shift is within a few decimetres of that. Plus a hint-like coordinate near Apeldoorn.
    const [lng, lat] = fromRD(155000, 463000);
    expect(lng).toBeCloseTo(5.38720621, 5);
    expect(lat).toBeCloseTo(52.1551744, 5);
    const p = toRD(5.9699, 52.2112);
    expect(Math.abs(p.x - 194_878)).toBeLessThan(100);
    expect(Math.abs(p.y - 469_485)).toBeLessThan(100);
  });
});
