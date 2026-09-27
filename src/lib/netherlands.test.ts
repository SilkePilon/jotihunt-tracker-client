import { describe, expect, test } from 'bun:test';
import { isInNetherlands } from './netherlands';

describe('isInNetherlands', () => {
  test.each([
    ['Arnhem', 5.9, 51.98],
    ['Zutphen (RD 2126 4692)', 6.2299, 52.2079],
    ['Maastricht', 5.69, 50.85],
    ['Texel', 4.8, 53.08],
  ])('%s is inside', (_name, lng, lat) => {
    expect(isInNetherlands(lng, lat)).toBe(true);
  });

  test.each([
    ['Kleve (DE)', 6.14, 51.79],
    ['Emmerich (DE)', 6.25, 51.83],
    ['Antwerpen (BE)', 4.4, 51.22],
    ['Noordzee', 3.5, 52.5],
  ])('%s is outside', (_name, lng, lat) => {
    expect(isInNetherlands(lng, lat)).toBe(false);
  });
});
