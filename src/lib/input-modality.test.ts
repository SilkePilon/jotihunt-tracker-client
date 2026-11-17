import { describe, expect, test } from 'bun:test';
import { nextModality } from './input-modality';

describe('nextModality', () => {
  test('a pointer press makes it pointer', () => {
    expect(nextModality('keyboard', { type: 'pointerdown' })).toBe('pointer');
  });

  test('a key press makes it keyboard', () => {
    expect(nextModality('pointer', { type: 'keydown', key: 'Enter' })).toBe('keyboard');
    expect(nextModality('pointer', { type: 'keydown', key: ' ' })).toBe('keyboard');
  });

  test('lone modifier keys and other events keep it', () => {
    expect(nextModality('pointer', { type: 'keydown', key: 'Shift' })).toBe('pointer');
    expect(nextModality('pointer', { type: 'keydown', key: 'Meta' })).toBe('pointer');
    expect(nextModality('keyboard', { type: 'focus' })).toBe('keyboard');
  });
});
