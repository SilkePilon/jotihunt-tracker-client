import { describe, expect, test } from 'bun:test';
import { MAP_RUNTIME_CACHING, OPENFREEMAP_STATIC, OPENFREEMAP_TILEJSON, OPENFREEMAP_TILES, PDOK_TILES } from './map-tile-cache';
import libertyJson from './map-style/liberty.json';

const matching = (url: string) => MAP_RUNTIME_CACHING.filter((entry) => entry.urlPattern.test(url)).map((entry) => entry.options.cacheName);

describe('map tile caching', () => {
  test('glyphs and sprites are cached first', () => {
    expect(OPENFREEMAP_STATIC.test('https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf')).toBe(true);
    expect(OPENFREEMAP_STATIC.test('https://tiles.openfreemap.org/sprites/ofm_f384/ofm@2x.png')).toBe(true);
  });

  test('TileJSON goes network-first with a 3 s timeout (it names the current tile version)', () => {
    expect(OPENFREEMAP_TILEJSON.test('https://tiles.openfreemap.org/planet')).toBe(true);
    expect(OPENFREEMAP_TILEJSON.test('https://tiles.openfreemap.org/natural_earth')).toBe(true);
    expect(OPENFREEMAP_TILEJSON.test('https://tiles.openfreemap.org/planet/20261110_001001_pt/14/8418/5390.pbf')).toBe(false);
    const route = MAP_RUNTIME_CACHING.find((entry) => entry.urlPattern === OPENFREEMAP_TILEJSON);
    expect(route?.handler).toBe('NetworkFirst');
    expect(route?.options).toMatchObject({ networkTimeoutSeconds: 3 });
  });

  test('vector tiles and relief go stale-while-revalidate', () => {
    expect(OPENFREEMAP_TILES.test('https://tiles.openfreemap.org/planet')).toBe(false);
    expect(OPENFREEMAP_TILES.test('https://tiles.openfreemap.org/planet/20261110_001001_pt/14/8418/5390.pbf')).toBe(true);
    expect(OPENFREEMAP_TILES.test('https://tiles.openfreemap.org/natural_earth/ne2sr/3/4/2.png')).toBe(true);
  });

  test('PDOK raster tiles', () => {
    expect(PDOK_TILES.test('https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/14/8418/5390.png')).toBe(true);
    expect(PDOK_TILES.test('https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/14/8418/5390.jpeg')).toBe(true);
  });

  test('every URL lands in exactly one cache', () => {
    expect(matching('https://tiles.openfreemap.org/fonts/a/0-255.pbf')).toEqual(['map-static']);
    expect(matching('https://tiles.openfreemap.org/planet/x/1/2/3.pbf')).toEqual(['map-tiles']);
    expect(matching('https://tiles.openfreemap.org/planet')).toEqual(['map-tilejson']);
  });

  test('the API and the app itself are never cached here', () => {
    for (const url of [
      'https://jotihunt.silkepilon.dev/api/buildings/15/1/2.pbf',
      'https://jotihunt.silkepilon.dev/api/fastfood',
      'https://jotihunt.silkepilon.dev/',
      // Another host's path that happens to contain ours
      'https://evil.example/https://tiles.openfreemap.org/planet',
    ]) {
      expect(matching(url)).toEqual([]);
    }
  });

  test("the bundled style's hosts are all covered", () => {
    const style = libertyJson as { glyphs: string; sprite: string; sources: Record<string, { url?: string; tiles?: string[] }> };
    const urls = [style.glyphs, style.sprite, ...Object.values(style.sources).flatMap((source) => [source.url, ...(source.tiles ?? [])])].filter(
      (url): url is string => !!url,
    );
    for (const url of urls) expect(matching(url)).toHaveLength(1);
  });
});
