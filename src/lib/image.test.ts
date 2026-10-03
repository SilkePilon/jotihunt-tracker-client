import { describe, expect, test } from 'bun:test';
import { resizeHint } from './image';

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
