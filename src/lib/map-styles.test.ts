import { describe, expect, test } from 'bun:test';
import type { RasterLayerSpecification, StyleSpecification } from 'maplibre-gl';
import { MapStyle } from '@/types/MapStyle';
import { DARK_RASTER_PAINT, resolveStaticMapStyle, themeRasters } from './map-styles';

const rasterPaint = (style: string | StyleSpecification, id: string) =>
  ((style as StyleSpecification).layers.find((layer) => layer.id === id) as RasterLayerSpecification | undefined)?.paint;

describe('resolveStaticMapStyle in the dark theme', () => {
  test('outdoors: the PDOK topo map toned down and muted', () => {
    expect(rasterPaint(resolveStaticMapStyle(MapStyle.Outdoors, true), 'pdok-brt')).toEqual({
      'raster-brightness-max': 0.75,
      'raster-saturation': -0.2,
      'raster-contrast': 0.05,
    });
  });

  test('satellite: only the brightest highlights', () => {
    expect(rasterPaint(resolveStaticMapStyle(MapStyle.Satellite, true), 'pdok-luchtfoto')).toEqual({ 'raster-brightness-max': 0.85 });
  });

  test('light theme unchanged; streets is the Liberty URL', () => {
    expect(rasterPaint(resolveStaticMapStyle(MapStyle.Outdoors), 'pdok-brt')).toBeUndefined();
    expect(rasterPaint(resolveStaticMapStyle(MapStyle.Satellite, false), 'pdok-luchtfoto')).toBeUndefined();
    expect(typeof resolveStaticMapStyle(MapStyle.Streets, false)).toBe('string');
  });

  test('streets: the darkened Liberty copy, built once', () => {
    const style = resolveStaticMapStyle(MapStyle.Streets, true);
    expect(typeof style).toBe('object');
    expect(resolveStaticMapStyle(MapStyle.Streets, true)).toBe(style);
    const background = (style as StyleSpecification).layers.find((layer) => layer.type === 'background') as { paint: Record<string, string> };
    expect(background.paint['background-color']).not.toBe('#f8f4f0');
  });
});

describe('themeRasters', () => {
  const hybrid: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      { id: 'pdok-luchtfoto', type: 'raster', source: 'pdok-luchtfoto', paint: { 'raster-opacity': 0.9 } },
      { id: 'label', type: 'symbol', source: 'openmaptiles' },
    ],
  };

  test('merges into existing raster paint and leaves other layers alone', () => {
    const themed = themeRasters(hybrid, true);
    expect(rasterPaint(themed, 'pdok-luchtfoto')).toEqual({ 'raster-opacity': 0.9, ...DARK_RASTER_PAINT['pdok-luchtfoto'] });
    expect(themed.layers[1]).toBe(hybrid.layers[1]);
    expect(rasterPaint(hybrid, 'pdok-luchtfoto')).toEqual({ 'raster-opacity': 0.9 });
  });

  test('light: the same object', () => {
    expect(themeRasters(hybrid, false)).toBe(hybrid);
  });
});
