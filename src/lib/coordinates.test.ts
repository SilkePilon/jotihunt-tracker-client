import { beforeAll, describe, expect, test } from 'bun:test';
import proj4 from 'proj4';
import { parseDMS, parseToWGS84, tokenizePair } from './coordinates';

beforeAll(() => {
  // Same definition as main.tsx registers globally
  proj4.defs(
    'RD',
    '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs',
  );
});

describe('parseToWGS84 decimal', () => {
  test('lat lng with dot or decimal comma', () => {
    expect(parseToWGS84('52.123 4.321')).toEqual({ lat: 52.123, lng: 4.321 });
    expect(parseToWGS84('52,123; 4,321')).toEqual({ lat: 52.123, lng: 4.321 });
    expect(parseToWGS84('N52.1 E4.3')).toEqual({ lat: 52.1, lng: 4.3 });
  });

  test('ambiguous pairs are read as lat lng, even when swapped', () => {
    expect(parseToWGS84('4.3, 52.1')).toEqual({ lat: 4.3, lng: 52.1 });
  });

  test('lng lat is detected only when the first number cannot be a latitude', () => {
    expect(parseToWGS84('92 4')).toEqual({ lat: 4, lng: 92 });
    expect(parseToWGS84('4 92')).toEqual({ lat: 4, lng: 92 });
  });
});

describe('parseToWGS84 DMS', () => {
  test('degrees, minutes, seconds with hemispheres', () => {
    expect(parseToWGS84('52°22\'30"N 4°53\'0"E')).toEqual({ lat: 52.375, lng: 4 + 53 / 60 });
    expect(parseToWGS84('52 22 30 N, 4 53 0 E')).toEqual({ lat: 52.375, lng: 4 + 53 / 60 });
  });

  test('hemisphere letters fix a swapped order', () => {
    expect(parseToWGS84("4°53'E 52°22'N")).toEqual({ lat: 52 + 22 / 60, lng: 4 + 53 / 60 });
  });

  test('S and W are negative', () => {
    expect(parseToWGS84('52.1N 4.3W')).toEqual({ lat: 52.1, lng: -4.3 });
    expect(parseToWGS84('S33.9 E18.4')).toEqual({ lat: -33.9, lng: 18.4 });
  });

  test('parseDMS rejects out-of-range values', () => {
    expect(parseDMS('95N', true)).toBeNull();
    expect(parseDMS('95E', false)).toBe(95);
    expect(parseDMS('abc')).toBeNull();
  });
});

describe('parseToWGS84 RD', () => {
  test('converts RD x y to WGS84', () => {
    const amersfoort = parseToWGS84('155000 463000');
    expect(amersfoort?.lng).toBeCloseTo(5.3872, 4);
    expect(amersfoort?.lat).toBeCloseTo(52.1552, 4);

    const zutphen = parseToWGS84('212600 469200');
    expect(zutphen?.lng).toBeCloseTo(6.2299, 4);
    expect(zutphen?.lat).toBeCloseTo(52.2079, 4);
  });

  test('converts any pair of large numbers, even outside the RD grid', () => {
    const far = parseToWGS84('500000 800000');
    expect(far?.lng).toBeCloseTo(10.7879, 4);
    expect(far?.lat).toBeCloseTo(55.065, 3);
  });

  test('a comma without a space is read as a decimal comma', () => {
    expect(parseToWGS84('155000,463000')).toBeNull();
  });
});

describe('parseToWGS84 garbage', () => {
  test.each(['', '  ', 'hello', 'abc def', '1', '200 200'])('%p is null', (input) => {
    expect(parseToWGS84(input)).toBeNull();
  });
});

describe('tokenizePair', () => {
  test('splits after the first hemisphere marker', () => {
    expect(tokenizePair('52 22 30 N, 4 53 0 E')).toEqual(['52 22 30 N', '4 53 0 E']);
  });

  test('splits in half otherwise', () => {
    expect(tokenizePair('52,1;4,3')).toEqual(['52.1', '4.3']);
    expect(tokenizePair('52')).toEqual(['52']);
  });
});
