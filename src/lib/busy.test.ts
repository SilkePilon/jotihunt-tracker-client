import { describe, expect, test } from 'bun:test';
import { BUSY_CLASSES, busyProps, isAriaDisabled } from './busy';

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

describe('isAriaDisabled', () => {
  test('true and "true" disable', () => {
    expect(isAriaDisabled(true)).toBe(true);
    expect(isAriaDisabled('true')).toBe(true);
  });

  test('false, "false" and absent leave the control enabled', () => {
    expect(isAriaDisabled(false)).toBe(false);
    expect(isAriaDisabled('false')).toBe(false);
    expect(isAriaDisabled(undefined)).toBe(false);
  });
});
