import { describe, expect, test } from 'bun:test';
import { MapStyle } from '@/types/MapStyle';
import { mapPalette, MAP_SEED } from '@/lib/map-style/material-style';
import { buildingColor, buildingsRefreshInterval, buildingsTileUrl, firstSymbolLayerId, formatMegabytes, isBuildingsTileUrl, jobLine, jobRunning, type BuildingsJob, type BuildingsStatus } from './buildings';

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

const job = (patch: Partial<BuildingsJob> = {}): BuildingsJob => ({ kind: 'prefetch', done: 3, total: 10, failed: 0, startedAt: '2026-10-15T12:00:00Z', finishedAt: null, ...patch });
const status = (j: BuildingsJob | null): BuildingsStatus => ({ tiles: 1, buildings: 2, bytes: 3, oldest: null, newest: null, job: j });

describe('admin helpers', () => {
  test('jobRunning and poll interval', () => {
    expect(jobRunning(undefined)).toBe(false);
    expect(jobRunning(status(null))).toBe(false);
    expect(jobRunning(status(job()))).toBe(true);
    expect(jobRunning(status(job({ finishedAt: '2026-10-15T12:05:00Z' })))).toBe(false);
    expect(buildingsRefreshInterval(status(job()))).toBe(1000);
    expect(buildingsRefreshInterval(status(null))).toBe(30000);
  });

  test('formatMegabytes', () => {
    expect(formatMegabytes(0)).toBe('0 MB');
    expect(formatMegabytes(12_345_678)).toBe('12,3 MB');
  });

  test('jobLine', () => {
    expect(jobLine(job())).toBe('Vooraf laden… 3 van 10 tegels');
    expect(jobLine(job({ kind: 'refresh', done: 10, finishedAt: 'x', failed: 2 }))).toBe('Vernieuwen klaar: 8 van 10 tegels gelukt');
    expect(jobLine(job({ done: 10, finishedAt: 'x' }))).toBe('Vooraf laden klaar: 10 van 10 tegels gelukt');
    expect(jobLine(job({ failed: 1 }))).toBe('Vooraf laden… 3 van 10 tegels (1 mislukt)');
  });
});
