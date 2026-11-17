import { describe, expect, test } from 'bun:test';
import { shortcutFor, type ShortcutKey } from './shortcuts';

const key = (value: string, extra: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key: value, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, defaultPrevented: false, ...extra,
});
const free = { typing: false, layerOpen: false };

describe('shortcutFor', () => {
  test('"/" is the group search, "i" the Intel window', () => {
    expect(shortcutFor(key('/'), free)).toBe('search');
    expect(shortcutFor(key('i'), free)).toBe('intel');
  });
  test('"/" with Shift still counts (layouts that need it), "I" with Shift does not', () => {
    expect(shortcutFor(key('/', { shiftKey: true }), free)).toBe('search');
    expect(shortcutFor(key('I', { shiftKey: true }), free)).toBeNull();
  });
  test('other keys are nothing', () => {
    expect(shortcutFor(key('k'), free)).toBeNull();
    expect(shortcutFor(key('Escape'), free)).toBeNull();
  });
  test('not with Ctrl, Cmd or Alt', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(shortcutFor(key('i', { [modifier]: true }), free)).toBeNull();
      expect(shortcutFor(key('/', { [modifier]: true }), free)).toBeNull();
    }
  });
  test('not while typing, composing (IME) or holding the key', () => {
    expect(shortcutFor(key('i'), { typing: true, layerOpen: false })).toBeNull();
    expect(shortcutFor(key('i', { isComposing: true }), free)).toBeNull();
    expect(shortcutFor(key('Process'), free)).toBeNull();
    expect(shortcutFor(key('/', { repeat: true }), free)).toBeNull();
  });
  test('not with a dialog or other layer open, nor when something else handled the key', () => {
    expect(shortcutFor(key('/'), { typing: false, layerOpen: true })).toBeNull();
    expect(shortcutFor(key('i', { defaultPrevented: true }), free)).toBeNull();
  });
});
