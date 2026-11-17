import { describe, expect, test } from 'bun:test';
import { readSessionFlag, writeSessionFlag } from './session-flag';

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

const throwing = {
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
};

describe('session flag', () => {
  test('round-trips through storage', () => {
    const storage = memoryStorage();
    expect(readSessionFlag('k', storage)).toBe(false);
    writeSessionFlag('k', storage);
    expect(readSessionFlag('k', storage)).toBe(true);
    expect(storage.getItem('k')).toBe('1');
  });

  test('blocked or missing storage reads as unset and never throws', () => {
    expect(readSessionFlag('k', throwing)).toBe(false);
    expect(() => writeSessionFlag('k', throwing)).not.toThrow();
    expect(readSessionFlag('k', undefined)).toBe(false);
    expect(() => writeSessionFlag('k', undefined)).not.toThrow();
  });
});
