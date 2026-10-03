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

  test('zooms out so a large box stays fully visible', () => {
    expectCrop(stickerCrop([0, 0, 1000, 1000], { width: 1000, height: 1000 }, { width: 500, height: 250 }), { scale: 0.25, x: 125, y: 0 });
  });

  test('wide frame, portrait photo: the whole sticker is inside the frame', () => {
    const { scale, x, y } = stickerCrop([385, 79, 673, 922], { width: 900, height: 1200 }, { width: 894, height: 240 });
    expect(scale).toBeLessThan(894 / 900);
    expect(y + (385 / 1000) * 1200 * scale).toBeGreaterThanOrEqual(0);
    expect(y + (673 / 1000) * 1200 * scale).toBeLessThanOrEqual(240);
    expect(x + (79 / 1000) * 900 * scale).toBeGreaterThanOrEqual(0);
    expect(x + (922 / 1000) * 900 * scale).toBeLessThanOrEqual(894);
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
