import type { ExpressionSpecification } from 'maplibre-gl';
import { describe, expect, test } from 'bun:test';
import { LABEL_MIN_SCALE, labelScale, ZOOM_SCALE_STOPS, zoomScale, zoomScaled } from './zoom-scale';

describe('zoomScale', () => {
  test('flat below the first and above the last stop', () => {
    expect(zoomScale(0)).toBe(0.55);
    expect(zoomScale(8)).toBe(0.55);
    expect(zoomScale(13)).toBe(1);
    expect(zoomScale(20)).toBe(1);
  });

  test('hits every stop', () => {
    for (const [zoom, scale] of ZOOM_SCALE_STOPS) expect(zoomScale(zoom)).toBeCloseTo(scale, 10);
  });

  test('linear between stops', () => {
    expect(zoomScale(9)).toBeCloseTo(0.65, 10);
    expect(zoomScale(11.5)).toBeCloseTo(0.875, 10);
  });

  test('never decreases with zoom', () => {
    let previous = 0;
    for (let zoom = 0; zoom <= 22; zoom += 0.25) {
      const scale = zoomScale(zoom);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });

  test('NaN zoom falls back to the smallest scale', () => {
    expect(zoomScale(Number.NaN)).toBe(0.55);
  });
});

describe('labelScale', () => {
  test('follows zoomScale but stays readable', () => {
    expect(labelScale(5)).toBe(LABEL_MIN_SCALE);
    expect(labelScale(13)).toBe(1);
    expect(labelScale(12)).toBeCloseTo(zoomScale(12), 10);
  });
});

describe('zoomScaled', () => {
  test('an interpolate expression on zoom with the base multiplied into the stops', () => {
    expect(zoomScaled(1)).toEqual(['interpolate', ['linear'], ['zoom'], 8, 0.55, 10, 0.75, 13, 1]);
    expect(zoomScaled(3.5)).toEqual(['interpolate', ['linear'], ['zoom'], 8, 1.925, 10, 2.625, 13, 3.5]);
  });

  test('rounds float noise away', () => {
    expect(zoomScaled(1.1)).toEqual(['interpolate', ['linear'], ['zoom'], 8, 0.605, 10, 0.825, 13, 1.1]);
  });

  test('label features keep the readable minimum where the curve goes below it', () => {
    const isLabel: ExpressionSpecification = ['==', ['get', 'hint'], true];
    expect(zoomScaled(1, isLabel)).toEqual(['interpolate', ['linear'], ['zoom'], 8, ['case', isLabel, 0.8, 0.55], 10, ['case', isLabel, 0.8, 0.75], 13, 1]);
  });

  test('agrees with zoomScale at the stops', () => {
    const expression = zoomScaled(6);
    for (const [zoom] of ZOOM_SCALE_STOPS) {
      const index = expression.indexOf(zoom, 3);
      expect(expression[index + 1]).toBeCloseTo(6 * zoomScale(zoom), 3);
    }
  });
});
