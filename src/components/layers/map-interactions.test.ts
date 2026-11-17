import { afterEach, describe, expect, test } from 'bun:test';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { clearPopupFocusRequest, popupFocusRequested } from '@/lib/popup-focus';
import { useNightDraw } from '@/stores/night-draw.store';
import { openLayerFeature, registerLayerHandlers, type LayerInteractions } from './map-interactions';

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
