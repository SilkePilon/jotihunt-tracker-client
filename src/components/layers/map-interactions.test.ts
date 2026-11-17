import { afterEach, describe, expect, test } from 'bun:test';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { clearPopupFocusRequest, popupFocusRequested } from '@/lib/popup-focus';
import { useNightDraw } from '@/stores/night-draw.store';
import type { Geometry, Position } from 'geojson';
import { featureNear, geometryDistance, nearestFeature, openLayerFeature, registerLayerHandlers, type LayerInteractions } from './map-interactions';

function fakeMap() {
  return { on: () => undefined, off: () => undefined, getLayer: () => undefined, getCanvas: () => ({ style: {} }) } as unknown as MaplibreMap;
}

describe('openLayerFeature', () => {
  afterEach(() => useNightDraw.setState({ active: false }));

  test('false for a layer that is not mounted', () => {
    expect(openLayerFeature(fakeMap(), 'team-pins', 'a')).toBe(false);
  });

  test('calls the layer onOpen and passes on its answer', () => {
    const map = fakeMap();
    const opened: (string | number)[] = [];
    const handlers: { current: LayerInteractions } = { current: { onOpen: (id) => (opened.push(id), id === 'a') } };
    const cleanup = registerLayerHandlers(map, ['team-pins'], handlers);
    expect(openLayerFeature(map, 'team-pins', 'a')).toBe(true);
    expect(openLayerFeature(map, 'team-pins', 'b')).toBe(false);
    expect(openLayerFeature(map, 'fox-markers', 'a')).toBe(false);
    expect(opened).toEqual(['a', 'b']);
    cleanup();
    expect(openLayerFeature(map, 'team-pins', 'a')).toBe(false);
  });

  test('false for a layer without onOpen', () => {
    const map = fakeMap();
    const cleanup = registerLayerHandlers(map, ['hunters'], { current: { onClick: () => undefined } });
    expect(openLayerFeature(map, 'hunters', 1)).toBe(false);
    cleanup();
  });

  test('no popups while a night area is being drawn', () => {
    const map = fakeMap();
    let opened = false;
    const cleanup = registerLayerHandlers(map, ['team-pins'], { current: { onOpen: () => (opened = true) } });
    useNightDraw.setState({ active: true });
    expect(openLayerFeature(map, 'team-pins', 'a')).toBe(false);
    expect(opened).toBe(false);
    cleanup();
  });
});

describe('openLayerFeature focus', () => {
  afterEach(clearPopupFocusRequest);

  test('requests popup focus only when asked and the popup opened', () => {
    const map = fakeMap();
    const cleanup = registerLayerHandlers(map, ['team-pins'], { current: { onOpen: (id) => id === 'a' } });
    openLayerFeature(map, 'team-pins', 'a');
    expect(popupFocusRequested()).toBe(false);
    openLayerFeature(map, 'team-pins', 'b', { focus: true });
    expect(popupFocusRequested()).toBe(false);
    openLayerFeature(map, 'team-pins', 'a', { focus: true });
    expect(popupFocusRequested()).toBe(true);
    cleanup();
  });
});

// Screen = lng/lat times 10 (y down is irrelevant here)
const project = ([lng, lat]: Position) => ({ x: lng * 10, y: lat * 10 });
const point = (lng: number, lat: number, id: string) => ({ id, geometry: { type: 'Point', coordinates: [lng, lat] } as Geometry });

describe('geometryDistance', () => {
  test('to a point, a line segment and a polygon outline', () => {
    expect(geometryDistance({ type: 'Point', coordinates: [1, 1] }, { x: 13, y: 14 }, project)).toBeCloseTo(5, 10);
    expect(geometryDistance({ type: 'LineString', coordinates: [[0, 0], [10, 0]] }, { x: 50, y: 7 }, project)).toBeCloseTo(7, 10);
    // Past the end of the segment: to its end point
    expect(geometryDistance({ type: 'LineString', coordinates: [[0, 0], [1, 0]] }, { x: 13, y: 4 }, project)).toBeCloseTo(5, 10);
    expect(geometryDistance({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, { x: 5, y: 12 }, project)).toBeCloseTo(2, 10);
  });

  test('infinite for an empty geometry', () => {
    expect(geometryDistance({ type: 'LineString', coordinates: [] }, { x: 0, y: 0 }, project)).toBe(Infinity);
  });
});

describe('nearestFeature', () => {
  test('the feature closest to the point', () => {
    const features = [point(0, 0, 'far'), point(1, 1, 'near'), point(3, 3, 'farther')];
    expect(nearestFeature(features, { x: 12, y: 9 }, project)?.id).toBe('near');
  });

  test('the topmost (first) on a tie', () => {
    expect(nearestFeature([point(1, 0, 'top'), point(-1, 0, 'below')], { x: 0, y: 0 }, project)?.id).toBe('top');
  });

  test('undefined without features; the first when none has a distance', () => {
    expect(nearestFeature([], { x: 0, y: 0 }, project)).toBeUndefined();
    const empty = { id: 'empty', geometry: { type: 'MultiPoint', coordinates: [] } as Geometry };
    expect(nearestFeature([empty], { x: 0, y: 0 }, project)?.id).toBe('empty');
  });
});

describe('featureNear', () => {
  function queryMap(exact: unknown[], box: unknown[]) {
    const queries: unknown[] = [];
    const map = {
      getLayer: (id: string) => (id === 'missing' ? undefined : {}),
      queryRenderedFeatures: (geometry: unknown, options: { layers: string[] }) => {
        queries.push([geometry, options.layers]);
        return Array.isArray((geometry as unknown[])[0]) ? box : exact;
      },
      project: project,
    } as unknown as MaplibreMap;
    return { map, queries };
  }

  test('an exact hit wins without a box query', () => {
    const { map, queries } = queryMap([point(5, 5, 'exact')], [point(1, 1, 'box')]);
    expect((featureNear(map, { x: 10, y: 10 }, ['fox-markers', 'missing'], 14) as unknown as { id: string }).id).toBe('exact');
    expect(queries).toEqual([[[10, 10], ['fox-markers']]]);
  });

  test('otherwise the nearest feature in the box around the point', () => {
    const { map, queries } = queryMap([], [point(2, 2, 'farther'), point(1, 1, 'nearer')]);
    expect((featureNear(map, { x: 12, y: 12 }, ['fox-markers'], 14) as unknown as { id: string }).id).toBe('nearer');
    expect(queries[1]).toEqual([[[-2, -2], [26, 26]], ['fox-markers']]);
  });

  test('undefined when no layer is mounted or the query throws', () => {
    const { map } = queryMap([], []);
    expect(featureNear(map, { x: 0, y: 0 }, ['missing'], 14)).toBeUndefined();
    const broken = { getLayer: () => ({}), queryRenderedFeatures: () => { throw new Error('style loading'); } } as unknown as MaplibreMap;
    expect(featureNear(broken, { x: 0, y: 0 }, ['fox-markers'], 14)).toBeUndefined();
  });
});
