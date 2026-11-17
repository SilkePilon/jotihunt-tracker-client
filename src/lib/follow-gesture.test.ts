import { describe, expect, test } from 'bun:test';
import { endsFollowing } from './follow-gesture';

const keydown = (key: string, shiftKey = false) => ({ type: 'keydown', key, shiftKey });

describe('endsFollowing', () => {
  test('our own camera moves (no originalEvent) never end it', () => {
    for (const type of ['dragstart', 'rotatestart', 'pitchstart', 'movestart'] as const) {
      expect(endsFollowing(type, undefined)).toBe(false);
    }
  });
  test('a drag, twist or tilt by the user ends it', () => {
    expect(endsFollowing('dragstart', { type: 'touchmove' })).toBe(true);
    expect(endsFollowing('rotatestart', { type: 'mousemove' })).toBe(true);
    expect(endsFollowing('pitchstart', keydown('ArrowUp', true))).toBe(true);
  });
  test('the arrow keys panning the map end it', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      expect(endsFollowing('movestart', keydown(key))).toBe(true);
    }
  });
  test('zooming keeps following: pinch, wheel, double tap and the +/- keys', () => {
    expect(endsFollowing('movestart', { type: 'touchstart' })).toBe(false);
    expect(endsFollowing('movestart', { type: 'touchmove' })).toBe(false);
    expect(endsFollowing('movestart', { type: 'wheel' })).toBe(false);
    expect(endsFollowing('movestart', { type: 'dblclick' })).toBe(false);
    expect(endsFollowing('movestart', keydown('+'))).toBe(false);
    expect(endsFollowing('movestart', keydown('-'))).toBe(false);
  });
  test('Shift+arrows on movestart leave it to their rotatestart/pitchstart', () => {
    expect(endsFollowing('movestart', keydown('ArrowLeft', true))).toBe(false);
  });
});
