import { afterEach, describe, expect, test } from 'bun:test';
import { FINE_POINTER_QUERY, intelAvailable, MOBILE_QUERY, shellAttribute, syncShellAttribute } from './media.hook';

const originalWindow = globalThis.window;

function fakeMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  const queries: string[] = [];
  globalThis.window = { matchMedia: (query: string) => (queries.push(query), media) } as unknown as Window & typeof globalThis;
  return { media, listeners, queries };
}

function fakeRoot() {
  const attributes = new Map<string, string>();
  return { root: { setAttribute: (name: string, value: string) => attributes.set(name, value) } as unknown as HTMLElement, attributes };
}

describe('MOBILE_QUERY', () => {
  test('phones by width, and touch screens held sideways (low)', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 767px), (pointer: coarse) and (max-height: 500px)');
  });
});

describe('syncShellAttribute', () => {
  afterEach(() => {
    globalThis.window = originalWindow;
  });

  test('sets data-shell now and on every change, until cleaned up', () => {
    const { media, listeners, queries } = fakeMedia(true);
    const { root, attributes } = fakeRoot();
    const cleanup = syncShellAttribute(root);
    expect(queries).toEqual([MOBILE_QUERY]);
    expect(attributes.get('data-shell')).toBe('mobile');
    media.matches = false;
    for (const listener of listeners) listener();
    expect(attributes.get('data-shell')).toBe('desktop');
    cleanup();
    expect(listeners.size).toBe(0);
  });

  test('shellAttribute', () => {
    expect(shellAttribute(true)).toBe('mobile');
    expect(shellAttribute(false)).toBe('desktop');
  });
});

describe('intelAvailable', () => {
  test('laptop layout always; the mobile shell only with a fine pointer (split screen)', () => {
    expect(FINE_POINTER_QUERY).toBe('(pointer: fine)');
    expect(intelAvailable(false, false)).toBe(true);
    expect(intelAvailable(false, true)).toBe(true);
    expect(intelAvailable(true, true)).toBe(true);
    expect(intelAvailable(true, false)).toBe(false);
  });
});
