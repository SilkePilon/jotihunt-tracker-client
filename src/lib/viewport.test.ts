import { describe, expect, test } from 'bun:test';
import { keyboardInset, visibleHeight } from './viewport';

describe('keyboardInset', () => {
  test('no visualViewport → 0', () => expect(keyboardInset(800, null)).toBe(0));
  test('toolbar jitter below the threshold is ignored', () => expect(keyboardInset(800, { height: 760, offsetTop: 0 })).toBe(0));
  test('keyboard open (resizes-visual)', () => expect(keyboardInset(800, { height: 470, offsetTop: 0 })).toBe(330));
  test('visual viewport scrolled by iOS while the keyboard is open', () => expect(keyboardInset(800, { height: 470, offsetTop: 40 })).toBe(290));
});

describe('visibleHeight', () => {
  test('uses the visual viewport when present', () => expect(visibleHeight(800, { height: 470 })).toBe(470));
  test('falls back to innerHeight', () => expect(visibleHeight(800, null)).toBe(800));
});
