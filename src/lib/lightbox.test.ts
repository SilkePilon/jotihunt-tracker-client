import { describe, expect, test } from 'bun:test';
import { LIGHTBOX_MAX_SCALE, LIGHTBOX_PAN, LIGHTBOX_START, LIGHTBOX_STEP, lightboxKey, zoomView } from './lightbox';

describe('zoomView', () => {
  test('clamps to the max scale', () => {
    expect(zoomView({ scale: 5, x: 3, y: 4 }, 10)).toEqual({ scale: LIGHTBOX_MAX_SCALE, x: 3, y: 4 });
  });

  test('back at 1x also resets the pan', () => {
    expect(zoomView({ scale: 1.2, x: 30, y: -20 }, 0.5)).toEqual(LIGHTBOX_START);
  });
});

describe('lightboxKey', () => {
  test('+ and = zoom in, - zooms out, 0 resets', () => {
    expect(lightboxKey(LIGHTBOX_START, '+')?.scale).toBeCloseTo(LIGHTBOX_STEP);
    expect(lightboxKey(LIGHTBOX_START, '=')?.scale).toBeCloseTo(LIGHTBOX_STEP);
    expect(lightboxKey({ scale: 2.8, x: 0, y: 0 }, '-')?.scale).toBeCloseTo(2);
    expect(lightboxKey({ scale: 3, x: 10, y: 10 }, '0')).toEqual(LIGHTBOX_START);
  });

  test('arrows pan only when zoomed in', () => {
    expect(lightboxKey(LIGHTBOX_START, 'ArrowLeft')).toEqual(LIGHTBOX_START);
    expect(lightboxKey({ scale: 2, x: 0, y: 0 }, 'ArrowLeft')).toEqual({ scale: 2, x: LIGHTBOX_PAN, y: 0 });
    expect(lightboxKey({ scale: 2, x: 0, y: 0 }, 'ArrowDown')).toEqual({ scale: 2, x: 0, y: -LIGHTBOX_PAN });
  });

  test('other keys are not handled', () => {
    expect(lightboxKey(LIGHTBOX_START, 'Enter')).toBeNull();
    expect(lightboxKey(LIGHTBOX_START, 'Tab')).toBeNull();
  });
});
