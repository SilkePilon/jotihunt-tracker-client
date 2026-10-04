import { describe, expect, test } from 'bun:test';
import { resizeHint, scaledSize, THUMB_MAX_SIDE } from './image';

describe('resizeHint', () => {
  test('scales the long side to maxSide, giving only that side', () => {
    expect(resizeHint(4000, 3000, 1600)).toEqual({ resizeWidth: 1600 });
    expect(resizeHint(3000, 4000, 1600)).toEqual({ resizeHeight: 1600 });
    expect(resizeHint(2000, 2000, 1600)).toEqual({ resizeWidth: 1600 });
  });

  test('no hint when small enough (never upscale) or the size is unknown', () => {
    expect(resizeHint(1600, 1200, 1600)).toBeNull();
    expect(resizeHint(800, 600, 1600)).toBeNull();
    expect(resizeHint(0, 0, 1600)).toBeNull();
  });
});

describe('scaledSize', () => {
  test('brings the long side to maxSide, keeping the aspect ratio', () => {
    expect(scaledSize(1600, 1200, THUMB_MAX_SIDE)).toEqual({ width: 320, height: 240 });
    expect(scaledSize(1200, 1600, THUMB_MAX_SIDE)).toEqual({ width: 240, height: 320 });
    expect(scaledSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  test('never upscales and never gives 0 px', () => {
    expect(scaledSize(200, 100, THUMB_MAX_SIDE)).toEqual({ width: 200, height: 100 });
    expect(scaledSize(10000, 1, THUMB_MAX_SIDE)).toEqual({ width: 320, height: 1 });
  });
});
