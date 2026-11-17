import { describe, expect, test } from 'bun:test';
import { SWAP, swapPreset } from './motion';

describe('swapPreset', () => {
  test('full motion: slide + blur', () => {
    const preset = swapPreset(false);
    expect(preset.initial).toEqual({ opacity: 0, y: 8, filter: 'blur(4px)' });
    expect(preset.animate).toEqual({ opacity: 1, y: 0, filter: 'blur(0px)' });
    expect(preset.exit).toEqual({ opacity: 0, y: -8, filter: 'blur(4px)' });
  });
  test('reduced motion: no filter (motion skips the slide itself)', () => {
    const preset = swapPreset(true);
    for (const target of [preset.initial, preset.animate, preset.exit]) expect('filter' in target).toBe(false);
    expect(preset.animate.opacity).toBe(1);
  });
  test('SWAP without a window is the full-motion preset', () => {
    expect(SWAP).toEqual(swapPreset(false));
  });
});
