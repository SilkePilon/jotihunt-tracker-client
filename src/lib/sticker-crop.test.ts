import { describe, expect, test } from 'bun:test';
import { MAX_ZOOM, stickerCrop } from './sticker-crop';

const square = { width: 1000, height: 1000 };
const frame = { width: 500, height: 250 };

function expectCrop(actual: { scale: number; x: number; y: number }, expected: { scale: number; x: number; y: number }) {
  expect(actual.scale).toBeCloseTo(expected.scale, 3);
  expect(actual.x).toBeCloseTo(expected.x, 2);
  expect(actual.y).toBeCloseTo(expected.y, 2);
}

describe('stickerCrop', () => {
  test('fits the padded box and centres it', () => {
    // box 400..500 → padded 385..515 (130px); fit = min(500/130, 250/130)
    const scale = 250 / 130;
    expectCrop(stickerCrop([400, 400, 500, 500], square, frame), { scale, x: 250 - 450 * scale, y: 125 - 450 * scale });
  });

  test('clamps so the image edge never enters the frame', () => {
    expectCrop(stickerCrop([0, 0, 100, 100], square, frame), { scale: 250 / 115, x: 0, y: 0 });
  });

  test('caps the zoom for a tiny box', () => {
    const scale = 0.5 * MAX_ZOOM;
    expectCrop(stickerCrop([495, 495, 505, 505], square, frame), { scale, x: 250 - 500 * scale, y: 125 - 500 * scale });
  });

  test('never zooms out below cover', () => {
    expectCrop(stickerCrop([0, 0, 1000, 1000], square, frame), { scale: 0.5, x: 0, y: -125 });
  });

  test('without a box: whole image, cover-fit and centred', () => {
    expectCrop(stickerCrop(null, square, frame), { scale: 0.5, x: 0, y: -125 });
  });

  test('portrait image: x clamps, y centres the sticker', () => {
    // x 60..180 → padded 42..198 (156), y 100..200 → padded 85..215 (130); fit = min(500/156, 250/130)
    const scale = 250 / 130;
    expectCrop(stickerCrop([100, 100, 200, 300], { width: 600, height: 1000 }, frame), { scale, x: 0, y: 125 - 150 * scale });
  });
});
