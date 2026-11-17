import { describe, expect, test } from 'bun:test';
import { BUSY_CLASSES, busyProps } from './busy';

describe('busyProps', () => {
  test('busy: aria-disabled and aria-busy', () => {
    expect(busyProps(true)).toEqual({ 'aria-disabled': true, 'aria-busy': true });
  });

  test('idle: both attributes left out', () => {
    expect(busyProps(false)).toEqual({ 'aria-disabled': undefined, 'aria-busy': undefined });
  });

  test('classes only apply while aria-disabled is set', () => {
    for (const cls of BUSY_CLASSES.split(' ')) expect(cls.startsWith('aria-disabled:')).toBe(true);
  });
});
