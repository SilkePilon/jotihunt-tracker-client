import { describe, expect, test } from 'bun:test';
import { MapStyle } from '@/types/MapStyle';
import { mapPalette, MAP_SEED } from '@/lib/map-style/material-style';
import { buildingColor, buildingsTileUrl, firstSymbolLayerId, isBuildingsTileUrl } from './buildings';

const API = 'https://jotihunt.silkepilon.dev/api';

describe('tile url', () => {
  test('template and matcher', () => {
    expect(buildingsTileUrl(API)).toBe(`${API}/buildings/{z}/{x}/{y}.pbf`);
    expect(isBuildingsTileUrl(`${API}/buildings/15/1/2.pbf`, API)).toBe(true);
    expect(isBuildingsTileUrl('https://tiles.openfreemap.org/planet/15/1/2.pbf', API)).toBe(false);
    expect(isBuildingsTileUrl(`${API}/markers`, API)).toBe(false);
  });
});

describe('buildingColor', () => {
  test('Material map: palette ramp on height, per theme', () => {
    for (const dark of [false, true]) {
      const p = mapPalette(MAP_SEED, dark);
      expect(buildingColor('', dark)).toEqual(['interpolate', ['linear'], ['get', 'h'], 0, p.surfaceContainerHigh, 30, p.surfaceContainerHighest]);
    }
  });

  test('other basemaps: fixed greys', () => {
    expect(buildingColor(MapStyle.Streets, true)).toBe('#d6d6d6');
    expect(buildingColor(MapStyle.Outdoors, false)).toBe('#d6d6d6');
    expect(buildingColor(MapStyle.Dark, false)).toBe('#5a5a5a');
    expect(buildingColor(MapStyle.Satellite, false)).toBe('#5a5a5a');
  });
});

describe('firstSymbolLayerId', () => {
  test('first symbol layer, or undefined', () => {
    expect(firstSymbolLayerId([{ id: 'bg', type: 'background' }, { id: 'road', type: 'line' }, { id: 'label', type: 'symbol' }, { id: 'l2', type: 'symbol' }])).toBe('label');
    expect(firstSymbolLayerId([{ id: 'sat', type: 'raster' }])).toBeUndefined();
  });
});
