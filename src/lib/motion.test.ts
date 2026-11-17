import { describe, expect, test } from 'bun:test';
import { REVEAL_TRANSITION, SWAP, revealTransition, swapPreset } from './motion';

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

describe('revealTransition', () => {
  test('full motion: height and opacity ease together', () => {
    expect(revealTransition(false, 'enter')).toBe(REVEAL_TRANSITION);
    expect(revealTransition(false, 'exit')).toBe(REVEAL_TRANSITION);
  });
  test('reduced motion: the height settles at once, only the fade eases', () => {
    const enter = revealTransition(true, 'enter') as Record<string, unknown>;
    expect(enter.height).toEqual({ duration: 0 });
    expect(enter.duration).toBe(0.2);
  });
  test('reduced motion: folding away, the height waits for the fade', () => {
    const exit = revealTransition(true, 'exit') as Record<string, unknown>;
    expect(exit.height).toEqual({ duration: 0, delay: 0.2 });
  });
});
