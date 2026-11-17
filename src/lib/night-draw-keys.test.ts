import { describe, expect, test } from 'bun:test';
import { droppedMessage, NUDGE_PX, nudgeDelta } from './night-draw-keys';

describe('night draw keys', () => {
  test('arrow keys nudge in screen px, Shift five times as far', () => {
    expect(nudgeDelta('ArrowLeft', false)).toEqual([-NUDGE_PX, 0]);
    expect(nudgeDelta('ArrowRight', false)).toEqual([NUDGE_PX, 0]);
    expect(nudgeDelta('ArrowUp', false)).toEqual([0, -NUDGE_PX]);
    expect(nudgeDelta('ArrowDown', true)).toEqual([0, NUDGE_PX * 5]);
  });

  test('other keys do not nudge', () => {
    expect(nudgeDelta('Enter', false)).toBeNull();
    expect(nudgeDelta('a', true)).toBeNull();
  });

  test('closing is mentioned from the third corner on', () => {
    expect(droppedMessage(2)).toBe('Punt 2 gezet. Pijltjes verschuiven het. Enter zet het volgende punt.');
    expect(droppedMessage(3)).toContain('nog eens Enter sluit het gebied');
  });
});
