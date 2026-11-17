import { expect, test } from 'bun:test';
import { isPickKey } from './map-pick-keys';

const key = (k: string, extra: Partial<Parameters<typeof isPickKey>[0]> = {}) => ({ key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, ...extra });

test('a plain Enter picks the map centre', () => {
  expect(isPickKey(key('Enter'))).toBe(true);
});

test('modifiers, held-down Enter and other keys do not', () => {
  expect(isPickKey(key('Enter', { ctrlKey: true }))).toBe(false);
  expect(isPickKey(key('Enter', { metaKey: true }))).toBe(false);
  expect(isPickKey(key('Enter', { altKey: true }))).toBe(false);
  expect(isPickKey(key('Enter', { shiftKey: true }))).toBe(false);
  expect(isPickKey(key('Enter', { repeat: true }))).toBe(false);
  expect(isPickKey(key(' '))).toBe(false);
  expect(isPickKey(key('ArrowUp'))).toBe(false);
});
