import { describe, expect, test } from 'bun:test';
import { MapStyle } from '@/types/MapStyle';
import { mapPalette, MAP_SEED } from '@/lib/map-style/material-style';
import { BUILDINGS_TILES, buildingColor, buildingsApiUrl, buildingsRefreshInterval, createTileCache, fetchBuildingTile, firstSymbolLayerId, formatMegabytes, jobLine, jobRunning, parseBuildingsUrl, type BuildingsJob, type BuildingsStatus } from './buildings';

const API = 'https://jotihunt.silkepilon.dev/api';

describe('tile url', () => {
  test('protocol template, parse, api url', () => {
    expect(BUILDINGS_TILES).toBe('jhbuildings://{z}/{x}/{y}');
    expect(parseBuildingsUrl('jhbuildings://15/16921/10826')).toEqual({ z: 15, x: 16921, y: 10826 });
    expect(parseBuildingsUrl('jhbuildings://15/a/1')).toBeUndefined();
    expect(parseBuildingsUrl('https://tiles.openfreemap.org/planet/15/1/2.pbf')).toBeUndefined();
    expect(buildingsApiUrl(API, { z: 15, x: 1, y: 2 })).toBe(`${API}/buildings/15/1/2.pbf`);
  });
});

describe('fetchBuildingTile', () => {
  const fetchReturning = (response: Response) => {
    const calls: [string, RequestInit | undefined][] = [];
    const fn = async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return response;
    };
    return { fn, calls };
  };

  test('sends the Authorization header and returns the body', async () => {
    const { fn, calls } = fetchReturning(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const data = await fetchBuildingTile(`${API}/buildings/15/1/2.pbf`, 'Bearer abc', fn);
    expect([...new Uint8Array(data)]).toEqual([1, 2, 3]);
    expect(calls[0][1]?.headers).toEqual({ Authorization: 'Bearer abc' });
  });

  test('204 is an empty tile', async () => {
    const { fn } = fetchReturning(new Response(null, { status: 204 }));
    expect((await fetchBuildingTile('u', '', fn)).byteLength).toBe(0);
  });

  test('non-OK rejects', async () => {
    const { fn } = fetchReturning(new Response('nope', { status: 401 }));
    expect(fetchBuildingTile('u', '', fn)).rejects.toThrow('401');
  });
});

describe('createTileCache', () => {
  test('concurrent requests for one tile share one fetch', async () => {
    let calls = 0;
    const cache = createTileCache(async () => {
      calls++;
      return new ArrayBuffer(1);
    });
    const results = await Promise.all([1, 2, 3, 4].map(() => cache.get('15/1/2')));
    expect(calls).toBe(1);
    expect(new Set(results).size).toBe(1);
  });

  test('a failed fetch is dropped, so the next call retries', async () => {
    let calls = 0;
    const cache = createTileCache(async () => {
      calls++;
      if (calls === 1) throw new Error('boom');
      return new ArrayBuffer(1);
    });
    expect(cache.get('k')).rejects.toThrow('boom');
    await Bun.sleep(0);
    expect((await cache.get('k')).byteLength).toBe(1);
    expect(calls).toBe(2);
  });

  test('LRU evicts the least recently used beyond capacity', async () => {
    const fetched: string[] = [];
    const cache = createTileCache(async (key) => {
      fetched.push(key);
      return new ArrayBuffer(0);
    }, 2);
    await cache.get('a');
    await cache.get('b');
    await cache.get('a'); // a is now the most recent
    await cache.get('c'); // evicts b
    await cache.get('a');
    await cache.get('b');
    expect(fetched).toEqual(['a', 'b', 'c', 'b']);
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
